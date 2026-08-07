"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Type,
  Underline as UnderlineIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AdminRichEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

function ToolbarButton({
  disabled,
  label,
  onClick,
  children,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="admin-rich__btn"
      disabled={disabled}
      aria-label={label}
      title={label}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function normalizeHtml(html: string): string {
  const trimmed = html.trim();
  if (
    !trimmed ||
    trimmed === "<br>" ||
    trimmed === "<div><br></div>" ||
    trimmed === "<p><br></p>" ||
    trimmed === "<p></p>"
  ) {
    return "";
  }
  return trimmed;
}

function isVisuallyEmpty(el: HTMLElement): boolean {
  return !el.textContent?.replace(/\u00a0/g, " ").trim();
}

/** Remplace les blocs de mise en page (titres, listes, citations) par des paragraphes. */
function unwrapBlockFormatting(root: HTMLElement) {
  const blockTags = ["H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE"];
  for (const tag of blockTags) {
    const nodes = Array.from(root.querySelectorAll(tag));
    for (const node of nodes) {
      const p = document.createElement("p");
      p.innerHTML = node.innerHTML;
      node.replaceWith(p);
    }
  }

  for (const list of Array.from(root.querySelectorAll("ul, ol"))) {
    const items = Array.from(list.querySelectorAll(":scope > li"));
    const frag = document.createDocumentFragment();
    for (const li of items) {
      const p = document.createElement("p");
      p.innerHTML = li.innerHTML;
      frag.appendChild(p);
    }
    list.replaceWith(frag);
  }
}

export function AdminRichEditor({
  value,
  onChange,
  disabled = false,
  placeholder = "Rédigez la description de l’article…",
}: AdminRichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  /** `null` = pas encore hydraté — obligatoire pour injecter `value` au montage. */
  const lastEmitted = useRef<string | null>(null);
  const [empty, setEmpty] = useState(!value.trim());
  const id = useId();

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value === lastEmitted.current) return;
    el.innerHTML = value || "";
    lastEmitted.current = value;
    setEmpty(isVisuallyEmpty(el));
  }, [value]);

  function emit() {
    const el = editorRef.current;
    if (!el) return;
    const html = normalizeHtml(el.innerHTML);
    lastEmitted.current = html;
    setEmpty(isVisuallyEmpty(el));
    onChange(html);
  }

  function run(command: string, commandValue?: string) {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emit();
  }

  function setLink() {
    if (disabled) return;
    const url = window.prompt("URL du lien", "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      run("unlink");
      return;
    }
    run("createLink", trimmed);
  }

  function clearFormatting() {
    if (disabled) return;
    const el = editorRef.current;
    if (!el) return;
    el.focus();

    const selection = window.getSelection();
    const hasRange =
      selection &&
      selection.rangeCount > 0 &&
      !selection.getRangeAt(0).collapsed &&
      el.contains(selection.anchorNode);

    if (!hasRange && selection) {
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    document.execCommand("removeFormat", false);
    document.execCommand("unlink", false);
    document.execCommand("formatBlock", false, "p");
    unwrapBlockFormatting(el);
    emit();
  }

  return (
    <div className={cn("admin-rich", disabled && "admin-rich--disabled")}>
      <div
        className="admin-rich__toolbar"
        role="toolbar"
        aria-label="Mise en forme"
        aria-controls={id}
      >
        <ToolbarButton label="Gras" disabled={disabled} onClick={() => run("bold")}>
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Italique"
          disabled={disabled}
          onClick={() => run("italic")}
        >
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Souligné"
          disabled={disabled}
          onClick={() => run("underline")}
        >
          <UnderlineIcon size={15} />
        </ToolbarButton>
        <span className="admin-rich__sep" aria-hidden />
        <ToolbarButton
          label="Titre 2"
          disabled={disabled}
          onClick={() => run("formatBlock", "h2")}
        >
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Titre 3"
          disabled={disabled}
          onClick={() => run("formatBlock", "h3")}
        >
          <Heading3 size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Paragraphe"
          disabled={disabled}
          onClick={() => run("formatBlock", "p")}
        >
          <Type size={15} />
        </ToolbarButton>
        <span className="admin-rich__sep" aria-hidden />
        <ToolbarButton
          label="Liste à puces"
          disabled={disabled}
          onClick={() => run("insertUnorderedList")}
        >
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Liste numérotée"
          disabled={disabled}
          onClick={() => run("insertOrderedList")}
        >
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton
          label="Citation"
          disabled={disabled}
          onClick={() => run("formatBlock", "blockquote")}
        >
          <Quote size={15} />
        </ToolbarButton>
        <ToolbarButton label="Lien" disabled={disabled} onClick={setLink}>
          <Link2 size={15} />
        </ToolbarButton>
        <span className="admin-rich__sep" aria-hidden />
        <ToolbarButton
          label="Supprimer la mise en forme"
          disabled={disabled}
          onClick={clearFormatting}
        >
          <RemoveFormatting size={15} />
        </ToolbarButton>
      </div>
      <div
        id={id}
        ref={editorRef}
        className={cn("admin-rich__content", empty && "is-empty")}
        contentEditable={!disabled}
        role="textbox"
        aria-multiline
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
      />
    </div>
  );
}
