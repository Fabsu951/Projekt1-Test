import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { ImageFormat, ShareImageModel } from "../services/shareImageModel";
import { isNativeApp } from "../services/native";
import { t } from "../i18n";

interface Props {
  model: ShareImageModel;
  /** Without extension, e.g. "snolage-kebnekaisefjallen". */
  fileName: string;
  title: string;
  /** Sent along with the image (a link to the page). */
  text: string;
  /** The button's text. */
  label: string;
}

/** The drawing code is only needed once someone opens the dialog. */
const drawing = () => import("../services/shareImage");

const FORMATS: Array<{ id: ImageFormat; label: string; hint: string }> = [
  { id: "post", label: t("Inlägg"), hint: t("4:5, för flöden") },
  { id: "story", label: t("Story"), hint: t("9:16, helskärm") },
];

/**
 * "Dela som bild": opens a preview of today's forecast as an image, in the
 * size the user picks, with buttons to share or save it. The caller only
 * renders this when there is a fresh, published level (services/shareImage).
 */
export default function ShareImageButton({ model, fileName, title, text, label }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ImageFormat>("post");
  const [image, setImage] = useState<{ blob: Blob; url: string; format: ImageFormat } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog, open);

  useEffect(() => {
    if (!open) return;
    let live = true;
    drawing()
      .then((m) => {
        if (live) setCanShare(m.canShareImage());
        return m.drawShareImage(model, format);
      })
      .then((blob) => {
        if (!live) return;
        const url = URL.createObjectURL(blob);
        setImage((old) => {
          if (old) URL.revokeObjectURL(old.url);
          return { blob, url, format };
        });
        setError(null);
      })
      .catch((err: unknown) => live && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      live = false;
    };
  }, [open, format, model]);

  useEffect(() => {
    if (!open) return;
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setStatus(null);
    setImage((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return null;
    });
    opener.current?.focus();
  }

  const name = `${fileName}-${format === "story" ? "story" : "inlagg"}.png`;
  const ready = image !== null && image.format === format;

  async function share() {
    if (!image) return;
    const outcome = await (await drawing()).shareImageFile(image.blob, name, title, text);
    setStatus(outcome === "failed" ? t("Bilden kunde inte delas. Spara den och dela den därifrån.") : null);
  }

  async function save() {
    if (!image) return;
    (await drawing()).downloadImage(image.blob, name);
    setStatus(t("Bilden är sparad."));
  }

  return (
    <>
      <button type="button" ref={opener} className="share-image-button" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <path d="m3.5 16 5-5 4 4 2.5-2.5 5.5 5.5" />
          <circle cx="15.5" cy="9" r="1.6" />
        </svg>
        {label}
      </button>
      {open && (
        <div className="share-image" role="dialog" aria-modal="true" aria-labelledby="share-image-title" ref={dialog}>
          <div className="share-image__panel">
            <div className="share-image__top">
              <h2 id="share-image-title" ref={heading} tabIndex={-1}>
                {t("Dela som bild")}
              </h2>
              <button type="button" className="share-image__close" onClick={close}>
                {t("Stäng")}
              </button>
            </div>
            <div className="share-image__formats" role="radiogroup" aria-label={t("Bildformat")}>
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={format === f.id}
                  className={`chip share-image__format${format === f.id ? " chip--on" : ""}`}
                  onClick={() => setFormat(f.id)}
                >
                  {f.label}
                  <small>{f.hint}</small>
                </button>
              ))}
            </div>
            <div className={`share-image__preview share-image__preview--${format}`}>
              {ready ? (
                <img src={image.url} alt={t("Förhandsvisning av bilden")} />
              ) : error ? (
                <p className="notice">{error}</p>
              ) : (
                <span className="skeleton" aria-label={t("Skapar bilden")} />
              )}
            </div>
            <p className="share-image__note">
              {t("Bilden visar prognosen som den är nu och uppdateras inte. Dela den samma dag.")}
            </p>
            <div className="share-image__actions">
              {canShare && (
                <button type="button" className="button button--primary" disabled={!ready} onClick={() => void share()}>
                  {t("Dela bilden")}
                </button>
              )}
              {!isNativeApp() && (
                <button type="button" className="button" disabled={!ready} onClick={save}>
                  {t("Spara bilden")}
                </button>
              )}
            </div>
            <p className="share-image__status" role="status">
              {status}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
