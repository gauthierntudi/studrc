//! Opt1mum magazine page rasterizer (PDF → WebP).
//!
//! Emits one NDJSON line per page on stdout:
//! `{"page":1,"total":120,"width":1400,"height":1980,"image":"...","thumb":"..."}`
//!
//! Designed for low RAM vs pdf.js+canvas: PDFium renders page-by-page and we
//! free bitmaps immediately after encoding.

use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use clap::Parser;
use image::imageops::FilterType;
use image::{DynamicImage, GenericImageView};
use pdfium_render::prelude::*;
use serde::Serialize;

#[derive(Parser, Debug)]
#[command(name = "magazine-pages-raster", about = "Rasterize PDF pages to WebP")]
struct Args {
    /// Input PDF path
    #[arg(long, short = 'i')]
    input: PathBuf,

    /// Output directory for .webp / .thumb.webp files
    #[arg(long, short = 'o')]
    out_dir: PathBuf,

    /// First page to render (1-based, inclusive)
    #[arg(long, default_value_t = 1)]
    start_page: u16,

    /// Target page width in CSS pixels
    #[arg(long, default_value_t = 1400)]
    width: u32,

    /// Thumbnail width
    #[arg(long, default_value_t = 200)]
    thumb_width: u32,

    /// WebP quality 1–100 for full pages
    #[arg(long, default_value_t = 80)]
    quality: u8,

    /// WebP quality 1–100 for thumbs
    #[arg(long, default_value_t = 72)]
    thumb_quality: u8,

    /// Optional path to libpdfium (directory or .so/.dylib/.dll). Default: next to binary / system.
    #[arg(long)]
    pdfium: Option<PathBuf>,
}

#[derive(Serialize)]
struct PageEvent<'a> {
    page: u16,
    total: u16,
    width: u32,
    height: u32,
    image: &'a str,
    thumb: &'a str,
}

fn bind_pdfium(pdfium_path: Option<&Path>) -> Result<Pdfium> {
    if let Some(path) = pdfium_path {
        if path.is_dir() {
            let lib = Pdfium::pdfium_platform_library_name_at_path(path);
            return Ok(Pdfium::new(
                Pdfium::bind_to_library(lib).map_err(|e| anyhow::anyhow!(e))?,
            ));
        }
        return Ok(Pdfium::new(
            Pdfium::bind_to_library(path).map_err(|e| anyhow::anyhow!(e))?,
        ));
    }

    // Prefer library next to this executable (Docker layout).
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidate = Pdfium::pdfium_platform_library_name_at_path(dir);
            if Path::new(&candidate).exists() {
                if let Ok(bindings) = Pdfium::bind_to_library(&candidate) {
                    return Ok(Pdfium::new(bindings));
                }
            }
        }
    }

    Ok(Pdfium::new(
        Pdfium::bind_to_system_library().map_err(|e| anyhow::anyhow!(e))?,
    ))
}

fn encode_webp(img: &DynamicImage, quality: u8) -> Result<Vec<u8>> {
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    let encoder = webp::Encoder::from_rgba(rgba.as_raw(), w, h);
    let mem = encoder.encode(quality as f32);
    Ok(mem.to_vec())
}

fn write_webp(path: &Path, img: &DynamicImage, quality: u8) -> Result<()> {
    let bytes = encode_webp(img, quality)?;
    std::fs::write(path, bytes)
        .with_context(|| format!("write {}", path.display()))?;
    Ok(())
}

fn main() -> Result<()> {
    let args = Args::parse();
    if args.start_page == 0 {
        bail!("--start-page must be >= 1");
    }
    if !(1..=100).contains(&args.quality) || !(1..=100).contains(&args.thumb_quality) {
        bail!("quality values must be 1..=100");
    }
    if !args.input.is_file() {
        bail!("input PDF not found: {}", args.input.display());
    }
    std::fs::create_dir_all(&args.out_dir)
        .with_context(|| format!("create {}", args.out_dir.display()))?;

    let pdfium = bind_pdfium(args.pdfium.as_deref())?;
    let document = pdfium
        .load_pdf_from_file(&args.input, None)
        .map_err(|e| anyhow::anyhow!("load PDF: {e}"))?;

    let total = document.pages().len() as u16;
    if total == 0 {
        bail!("PDF has no pages");
    }
    let start = args.start_page.min(total.saturating_add(1));

    let mut stdout = BufWriter::new(std::io::stdout().lock());
    writeln!(
        stdout,
        "{}",
        serde_json::json!({ "event": "meta", "total": total, "start_page": start })
    )?;
    stdout.flush()?;

    if start > total {
        return Ok(());
    }

    let render_config = PdfRenderConfig::new()
        .set_target_width(args.width as i32)
        // Generous max height for tall magazine pages.
        .set_maximum_height((args.width as f32 * 2.8) as i32);

    for (index, page) in document.pages().iter().enumerate() {
        let page_number = (index + 1) as u16;
        if page_number < start {
            continue;
        }

        let bitmap = page
            .render_with_config(&render_config)
            .map_err(|e| anyhow::anyhow!("render page {page_number}: {e}"))?;
        let image = bitmap.as_image();
        // Drop bitmap ASAP after copy into DynamicImage.
        drop(bitmap);

        let rgb = DynamicImage::ImageRgb8(image.into_rgb8());
        let (width, height) = rgb.dimensions();

        let image_path = args.out_dir.join(format!("{page_number}.webp"));
        let thumb_path = args.out_dir.join(format!("{page_number}.thumb.webp"));

        write_webp(&image_path, &rgb, args.quality)?;

        let thumb = rgb.resize(
            args.thumb_width,
            ((height as f32) * (args.thumb_width as f32) / (width as f32)).max(1.0) as u32,
            FilterType::Triangle,
        );
        write_webp(&thumb_path, &thumb, args.thumb_quality)?;
        drop(rgb);
        drop(thumb);

        let event = PageEvent {
            page: page_number,
            total,
            width,
            height,
            image: image_path.to_str().unwrap_or_default(),
            thumb: thumb_path.to_str().unwrap_or_default(),
        };
        writeln!(stdout, "{}", serde_json::to_string(&event)?)?;
        stdout.flush()?;
    }

    Ok(())
}
