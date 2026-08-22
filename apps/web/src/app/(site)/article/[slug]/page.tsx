import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articlesPublicApi, type PublicArticleCard } from "@/lib/api";
import {
  absoluteMediaUrl,
  getSiteUrl,
  plainDescription,
} from "@/lib/site-url";
import { ArticleMagazineFloat } from "./article-magazine-float";
import "./article.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const article = await articlesPublicApi.bySlug(slug);
    if (!article.isPublished) {
      return { title: "Article", robots: { index: false, follow: false } };
    }

    const title = article.title;
    const description =
      plainDescription(article.excerpt) ??
      plainDescription(article.content) ??
      "Article STUDRC";
    const image = absoluteMediaUrl(article.coverUrl);
    const url = `${getSiteUrl()}/article/${encodeURIComponent(article.slug)}`;
    const authors = article.author?.name ? [article.author.name] : undefined;

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: "article",
        locale: "fr_FR",
        siteName: "STUDRC",
        title,
        description,
        url,
        publishedTime: article.publishedAt ?? undefined,
        modifiedTime: article.updatedAt ?? undefined,
        authors,
        section: article.category ?? undefined,
        images: image
          ? [
              {
                url: image,
                alt: article.coverCaption?.trim() || title,
              },
            ]
          : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return { title: "Article" };
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  let article;
  try {
    article = await articlesPublicApi.bySlug(slug);
  } catch {
    notFound();
  }

  if (!article.isPublished) notFound();

  let related: PublicArticleCard[] = [];
  try {
    const res = await articlesPublicApi.related(slug, 6);
    related = res.items;
  } catch {
    related = [];
  }

  const cover = article.coverUrl;
  const dateLabel = article.publishedAt
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(article.publishedAt))
    : null;

  return (
    <>
      <article className="opt-article">
        <div className="opt-article__inner">
          <nav className="opt-article__crumb" aria-label="Fil d’Ariane">
            <Link href="/">Accueil</Link>
            <span aria-hidden>/</span>
            {article.category ? (
              <>
                <Link href={`/rubrique/${article.category}`}>
                  {article.category}
                </Link>
                <span aria-hidden>/</span>
              </>
            ) : null}
            <span>{article.title}</span>
          </nav>

          <header className="opt-article__head">
            {article.category ? (
              <p className="opt-article__cat">{article.category}</p>
            ) : null}
            <h1 className="opt-article__title">{article.title}</h1>
            <p className="opt-article__meta">
              {article.author?.name ? (
                <span>Par {article.author.name}</span>
              ) : null}
              {dateLabel ? <span>{dateLabel}</span> : null}
            </p>
            {article.excerpt ? (
              <p className="opt-article__excerpt">{article.excerpt}</p>
            ) : null}
          </header>

          {cover ? (
            <figure className="opt-article__cover">
              <div className="opt-article__cover-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cover} alt={article.coverCaption?.trim() || ""} />
              </div>
              {article.coverCaption?.trim() ? (
                <figcaption className="opt-article__caption">
                  {article.coverCaption.trim()}
                </figcaption>
              ) : null}
            </figure>
          ) : null}

          <div className="opt-article__body">
            {article.blocks.length > 0
              ? article.blocks.map((block, i) => (
                  <section
                    key={block.id ?? `block-${i}`}
                    className="opt-article__block"
                  >
                    {block.title ? <h2>{block.title}</h2> : null}
                    {block.coverUrl ? (
                      <figure className="opt-article__block-figure">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={block.coverUrl}
                          alt={block.coverCaption?.trim() || ""}
                          className="opt-article__block-cover"
                        />
                        {block.coverCaption?.trim() ? (
                          <figcaption className="opt-article__caption">
                            {block.coverCaption.trim()}
                          </figcaption>
                        ) : null}
                      </figure>
                    ) : null}
                    <div
                      className="opt-article__html"
                      dangerouslySetInnerHTML={{ __html: block.content }}
                    />
                  </section>
                ))
              : (
                <div
                  className="opt-article__html"
                  dangerouslySetInnerHTML={{ __html: article.content }}
                />
              )}
          </div>

          {related.length > 0 ? (
            <section
              className="opt-article__more"
              aria-labelledby="opt-article-more"
            >
              <h2 id="opt-article-more" className="opt-article__more-title">
                À lire aussi
              </h2>
              <div className="opt-article__more-grid">
                {related.map((item) => (
                  <Link
                    key={item.id}
                    href={`/article/${encodeURIComponent(item.slug)}`}
                    className="opt-article__more-card"
                  >
                    <span className="opt-article__more-thumb">
                      {item.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.coverUrl} alt="" />
                      ) : null}
                    </span>
                    <span className="opt-article__more-meta">
                      {item.categoryLabel ? (
                        <span
                          className={`opt-article__more-cat opt-article__more-cat--${item.categoryTone || "teal"}`}
                        >
                          {item.categoryLabel}
                        </span>
                      ) : null}
                      <span className="opt-article__more-card-title">
                        {item.title}
                      </span>
                      {item.dateLabel ? (
                        <span className="opt-article__more-date">
                          {item.dateLabel}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </article>

      {article.magazine ? (
        <ArticleMagazineFloat magazine={article.magazine} />
      ) : null}
    </>
  );
}
