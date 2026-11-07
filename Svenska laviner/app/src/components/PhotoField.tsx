import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { prepareImage } from "../utils/image";
import { t } from "../i18n";
import Icon from "./Icon";

/** Phones and the apps get a button straight to the camera; a desktop only picks files. */
function hasCamera(): boolean {
  if (Capacitor.isNativePlatform()) return true;
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * A photo for an observation: "Ta bild" opens the camera directly, "Välj bild"
 * the gallery. The picture is shrunk and re-encoded here (which also drops
 * the GPS data in it) and shown as a preview that can be removed.
 */
export default function PhotoField({ onChange, onError }: { onChange: (image: Blob | null) => void; onError: (message: string | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [withCamera] = useState(hasCamera);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function take(file: File | undefined) {
    if (!file) return;
    onError(null);
    setBusy(true);
    try {
      const blob = await prepareImage(file);
      setPreview(URL.createObjectURL(blob));
      onChange(blob);
    } catch {
      onError(t("Kunde inte läsa bilden. Prova en annan bild (JPEG eller PNG)."));
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setPreview(null);
    onChange(null);
  }

  const input = (ref: typeof camera, capture: boolean) => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      capture={capture ? "environment" : undefined}
      hidden
      onChange={(e) => {
        void take(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  return (
    <div className="photo-field">
      {input(camera, true)}
      {input(gallery, false)}
      {preview && <img className="photo-field__preview" src={preview} alt={t("Förhandsvisning av bilden")} />}
      <div className="photo-field__actions">
        {withCamera && (
          <button type="button" className="button photo-field__camera" disabled={busy} onClick={() => camera.current?.click()}>
            <Icon name="camera" />
            {preview ? t("Ta en ny bild") : t("Ta bild")}
          </button>
        )}
        <button type="button" className="button" disabled={busy} onClick={() => gallery.current?.click()}>
          <Icon name="image" />
          {withCamera ? t("Välj från galleriet") : preview ? t("Välj en annan bild") : t("Välj bild")}
        </button>
        {preview && (
          <button type="button" className="link-button" onClick={clear}>
            {t("Ta bort bilden")}
          </button>
        )}
      </div>
      {busy && <p className="form__hint" role="status">{t("Förbereder bilden…")}</p>}
    </div>
  );
}
