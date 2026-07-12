"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";

const starter = [
  { id: "mascot", name: "Spray-Paint Mascot", tag: "Logo", status: "Approved", preview: null },
  { id: "manifesto", name: "Dangerous Manifesto", tag: "Back Print", status: "Needs file", preview: null },
  { id: "bolt", name: "Lightning Mark", tag: "Icon", status: "Approved", preview: null }
];

export default function DesignLibrary() {
  const [items, setItems] = useState(starter);
  const fileInput = useRef(null);

  function handleFiles(files) {
    const next = Array.from(files).map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      tag: "Uploaded",
      status: "Local preview",
      preview: URL.createObjectURL(file)
    }));
    setItems((current) => [...next, ...current]);
  }

  return (
    <section className="panel" id="designs">
      <div className="panelHead">
        <div>
          <span className="eyebrow">DESIGN LIBRARY</span>
          <h2>Approved artwork and assets</h2>
        </div>
        <button onClick={() => fileInput.current?.click()}>
          <Upload size={17} /> Add artwork
        </button>
        <input
          ref={fileInput}
          hidden
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          multiple
          onChange={(event) => handleFiles(event.target.files || [])}
        />
      </div>

      <div
        className="dropZone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFiles(event.dataTransfer.files);
        }}
      >
        <ImagePlus size={28} />
        <strong>Drop artwork here</strong>
        <span>PNG, JPG, WEBP or SVG. Uploads are preview-only until Supabase Storage is connected.</span>
      </div>

      <div className="assetGrid">
        {items.map((item) => (
          <article className="assetCard" key={item.id}>
            <div className="assetPreview">
              {item.preview ? <img src={item.preview} alt="" /> : <span>☹</span>}
            </div>
            <div>
              <small>{item.tag}</small>
              <h3>{item.name}</h3>
              <span className="assetStatus">{item.status}</span>
            </div>
            <button
              className="iconButton"
              title="Remove"
              onClick={() => setItems((current) => current.filter((x) => x.id !== item.id))}
            >
              <Trash2 size={15} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
