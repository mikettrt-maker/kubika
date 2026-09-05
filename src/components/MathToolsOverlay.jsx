import { useState, useRef, useEffect, useCallback } from "react";
import katex from "katex";

const PEN_COLORS = [
  { label: "Negro",    value: "#1e293b" },
  { label: "Rojo",     value: "#ef4444" },
  { label: "Azul",     value: "#3b82f6" },
  { label: "Verde",    value: "#22c55e" },
  { label: "Naranja",  value: "#f97316" },
  { label: "Morado",   value: "#a855f7" },
  { label: "Rosa",     value: "#ec4899" },
  { label: "Amarillo", value: "#eab308" },
];

function OverlayTextBox({ box, onDragEnd, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(!box.text);
  const [text, setText] = useState(box.text || "");
  const [color, setColor] = useState(box.color || "#1e293b");
  const inputRef = useRef(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const startDrag = (e) => {
    if (editing) return;
    e.preventDefault();
    const startX = e.clientX - box.x, startY = e.clientY - box.y;
    const onMove = (mv) => onDragEnd(box.id, mv.clientX - startX, mv.clientY - startY);
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const commit = () => { setEditing(false); onUpdate(box.id, { text, color }); };

  return (
    <div className="absolute select-none" style={{ left: box.x, top: box.y, zIndex: 30 }}
         onMouseDown={startDrag}
         onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>
      {editing ? (
        <div className="bg-white/90 border border-blue-300 rounded-xl shadow-lg p-2 backdrop-blur-sm min-w-[160px]"
             onMouseDown={(e) => e.stopPropagation()}>
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") commit(); e.stopPropagation(); }}
            placeholder="Escribe una nota..." className="w-full outline-none text-sm bg-transparent" style={{ color }} />
          <div className="flex gap-1 mt-1 flex-wrap">
            {PEN_COLORS.map(c => (
              <button key={c.value} onMouseDown={(e) => e.preventDefault()} onClick={() => setColor(c.value)}
                className={`w-4 h-4 rounded-full border-2 ${color === c.value ? "border-slate-800 scale-125" : "border-transparent"}`}
                style={{ backgroundColor: c.value }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="relative group cursor-grab">
          <span className="text-sm font-medium select-none whitespace-nowrap drop-shadow-sm" style={{ color }}>
            {text || <span className="text-slate-400 italic text-xs">Texto</span>}
          </span>
          <button onClick={(e) => { e.stopPropagation(); onDelete(box.id); }}
            className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] hidden group-hover:flex items-center justify-center leading-none">
            x
          </button>
        </div>
      )}
    </div>
  );
}

function OverlayMathBox({ box, onDragEnd, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(!box.latex);
  const [latex, setLatex] = useState(box.latex || "");
  const [html, setHtml] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (latex.trim()) {
      try { setHtml(katex.renderToString(latex, { throwOnError: false, displayMode: false })); }
      catch { setHtml("<span style=\"color:#ef4444;font-size:11px\">Error en formula</span>"); }
    } else setHtml("");
  }, [latex]);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const startDrag = (e) => {
    if (editing) return;
    e.preventDefault();
    const startX = e.clientX - box.x, startY = e.clientY - box.y;
    const onMove = (mv) => onDragEnd(box.id, mv.clientX - startX, mv.clientY - startY);
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const commit = () => { setEditing(false); onUpdate(box.id, { latex }); };

  const quickInserts = [
    { label: "a/b", v: "\\frac{a}{b}" }, { label: "x^2", v: "x^{2}" },
    { label: "sqrt", v: "\\sqrt{x}" }, { label: "x", v: "\\times" },
    { label: "div", v: "\\div" }, { label: "<=", v: "\\leq" }, { label: ">=", v: "\\geq" },
  ];

  const insertAt = (str) => {
    const inp = inputRef.current;
    if (!inp) return;
    const s = inp.selectionStart, e2 = inp.selectionEnd;
    const next = latex.slice(0, s) + str + latex.slice(e2);
    setLatex(next);
    setTimeout(() => { inp.selectionStart = inp.selectionEnd = s + str.length; inp.focus(); }, 0);
  };

  return (
    <div className="absolute select-none" style={{ left: box.x, top: box.y, zIndex: 30 }}
         onMouseDown={startDrag}
         onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>
      {editing ? (
        <div className="bg-white/95 border border-purple-300 rounded-xl shadow-lg p-2 backdrop-blur-sm min-w-[200px]"
             onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap gap-1 mb-1">
            {quickInserts.map(q => (
              <button key={q.label} onMouseDown={(e) => e.preventDefault()} onClick={() => insertAt(q.v)}
                className="px-1.5 py-0.5 text-[10px] font-mono bg-purple-50 text-purple-700 rounded border border-purple-200 hover:bg-purple-100">
                {q.label}
              </button>
            ))}
          </div>
          <textarea ref={inputRef} value={latex} rows={2}
            onChange={(e) => setLatex(e.target.value)} onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Escape") commit(); e.stopPropagation(); }}
            placeholder="\frac{1}{2}"
            className="w-full text-xs font-mono border border-purple-200 rounded p-1 outline-none focus:ring-1 focus:ring-purple-300 resize-none" />
          {html && <div className="mt-1 text-center text-sm border-t border-slate-100 pt-1" dangerouslySetInnerHTML={{ __html: html }} />}
        </div>
      ) : (
        <div className="relative group cursor-grab">
          {html ? <div className="text-base drop-shadow-sm" dangerouslySetInnerHTML={{ __html: html }} />
                : <span className="text-slate-400 italic text-xs">Doble clic para formula...</span>}
          <button onClick={(e) => { e.stopPropagation(); onDelete(box.id); }}
            className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] hidden group-hover:flex items-center justify-center leading-none">
            x
          </button>
        </div>
      )}
    </div>
  );
}

export default function MathToolsOverlay({ libroId, userId }) {
  const canvasRef = useRef(null);
  const [tool, setTool] = useState(null);
  const [color, setColor] = useState("#ef4444");
  const [lineWidth, setLineWidth] = useState(4);
  const [textBoxes, setTextBoxes] = useState([]);
  const [mathBoxes, setMathBoxes] = useState([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const drawing = useRef(false);
  const lineStart = useRef(null);
  const snapshotRef = useRef(null);

  const storageKey = `kubika_math_${userId || "guest"}_${libroId}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      if (saved.textBoxes) setTextBoxes(saved.textBoxes);
      if (saved.mathBoxes) setMathBoxes(saved.mathBoxes);
      if (saved.canvasData && canvasRef.current) {
        const img = new Image();
        img.onload = () => { const ctx = canvasRef.current?.getContext("2d"); if (ctx) ctx.drawImage(img, 0, 0); };
        img.src = saved.canvasData;
      }
    } catch { /* ignorar */ }
  }, [storageKey]);

  const save = useCallback((newTB, newMB) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        canvasData: canvasRef.current?.toDataURL() || "",
        textBoxes: newTB ?? textBoxes,
        mathBoxes: newMB ?? mathBoxes,
      }));
    } catch { /* ignorar */ }
  }, [storageKey, textBoxes, mathBoxes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const resize = () => {
      const tmp = document.createElement("canvas");
      tmp.width = canvas.width; tmp.height = canvas.height;
      tmp.getContext("2d").drawImage(canvas, 0, 0);
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
      canvas.getContext("2d").drawImage(tmp, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onPointerDown = (e) => {
    if (!tool || tool === "text" || tool === "latex") return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext("2d");
    if (tool === "eraser") {
      drawing.current = true;
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 24; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y); return;
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (tool === "line") {
      lineStart.current = pos;
      snapshotRef.current = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    drawing.current = true;
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
  };

  const onPointerMove = (e) => {
    if (!drawing.current || !tool) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext("2d");
    if (tool === "eraser") { ctx.lineTo(pos.x, pos.y); ctx.stroke(); return; }
    if (tool === "pen") { ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
    else if (tool === "line" && lineStart.current) {
      ctx.putImageData(snapshotRef.current, 0, 0);
      ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(lineStart.current.x, lineStart.current.y);
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
    }
  };

  const onPointerUp = (e) => {
    if (!drawing.current) return;
    drawing.current = false;
    const ctx = canvasRef.current.getContext("2d");
    ctx.globalCompositeOperation = "source-over";
    if (tool === "line" && lineStart.current) {
      const pos = getPos(e);
      ctx.putImageData(snapshotRef.current, 0, 0);
      ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(lineStart.current.x, lineStart.current.y);
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
      lineStart.current = null; snapshotRef.current = null;
    }
    save();
  };

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (tool === "text") {
      const newBox = { id: Date.now(), x, y, text: "", color: "#1e293b" };
      const next = [...textBoxes, newBox];
      setTextBoxes(next); save(next, mathBoxes);
    } else if (tool === "latex") {
      const newBox = { id: Date.now(), x, y, latex: "" };
      const next = [...mathBoxes, newBox];
      setMathBoxes(next); save(textBoxes, next);
    }
  };

  const updateTextBox = (id, data) => { const n = textBoxes.map(b => b.id === id ? { ...b, ...data } : b); setTextBoxes(n); save(n, mathBoxes); };
  const deleteTextBox = (id) => { const n = textBoxes.filter(b => b.id !== id); setTextBoxes(n); save(n, mathBoxes); };
  const dragTextBoxEnd = (id, x, y) => { const n = textBoxes.map(b => b.id === id ? { ...b, x, y } : b); setTextBoxes(n); save(n, mathBoxes); };
  const updateMathBox = (id, data) => { const n = mathBoxes.map(b => b.id === id ? { ...b, ...data } : b); setMathBoxes(n); save(textBoxes, n); };
  const deleteMathBox = (id) => { const n = mathBoxes.filter(b => b.id !== id); setMathBoxes(n); save(textBoxes, n); };
  const dragMathBoxEnd = (id, x, y) => { const n = mathBoxes.map(b => b.id === id ? { ...b, x, y } : b); setMathBoxes(n); save(textBoxes, n); };

  const clearAll = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setTextBoxes([]); setMathBoxes([]);
    localStorage.removeItem(storageKey);
  };

  const cursor = tool === "pen" || tool === "line" ? "crosshair"
    : tool === "eraser" ? "cell"
    : tool === "text" ? "text"
    : tool === "latex" ? "cell"
    : "default";

  const isDrawingTool = tool === "pen" || tool === "line" || tool === "eraser";

  return (
    <div className="absolute inset-0 z-10" style={{ pointerEvents: tool ? "all" : "none" }}>
      <canvas ref={canvasRef} className="absolute inset-0"
        style={{ cursor, pointerEvents: isDrawingTool ? "all" : "none", touchAction: "none" }}
        onMouseDown={onPointerDown} onMouseMove={onPointerMove}
        onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
        onClick={handleCanvasClick} />

      {textBoxes.map(box => (
        <OverlayTextBox key={box.id} box={box}
          onDragEnd={dragTextBoxEnd} onDelete={deleteTextBox} onUpdate={updateTextBox} />
      ))}
      {mathBoxes.map(box => (
        <OverlayMathBox key={box.id} box={box}
          onDragEnd={dragMathBoxEnd} onDelete={deleteMathBox} onUpdate={updateMathBox} />
      ))}

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1 px-3 py-2 bg-white/90 backdrop-blur-sm border-t border-slate-200 shadow-lg"
           style={{ pointerEvents: "all", zIndex: 50 }}>
        {[
          { id: "pen",    icon: "\uD83D\uDD8D\uFE0F", title: "Plum\u00F3n libre" },
          { id: "line",   icon: "\uD83D\uDCCF", title: "Trazar l\u00EDnea" },
          { id: "eraser", icon: "\u2B1C", title: "Borrador" },
          { id: "text",   icon: "T",  title: "Texto libre" },
          { id: "latex",  icon: "\u03A3",  title: "F\u00F3rmula LaTeX" },
        ].map(t => (
          <button key={t.id} onClick={() => setTool(prev => prev === t.id ? null : t.id)} title={t.title}
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-base font-bold transition-all
              ${tool === t.id ? "bg-indigo-600 text-white shadow-md scale-105" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {t.icon}
          </button>
        ))}

        <div className="w-px h-6 bg-slate-200 mx-1" />

        <div className="relative">
          <button onClick={() => setShowColorPicker(p => !p)} title="Color"
            className="w-9 h-9 rounded-lg border-2 border-slate-300 shadow-sm hover:scale-105 transition-transform"
            style={{ backgroundColor: color }} />
          {showColorPicker && (
            <div className="absolute bottom-11 left-1/2 -translate-x-1/2 flex gap-1.5 bg-white/95 border border-slate-200 rounded-xl shadow-xl p-2 backdrop-blur-sm">
              {PEN_COLORS.map(c => (
                <button key={c.value} onClick={() => { setColor(c.value); setShowColorPicker(false); }} title={c.label}
                  className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 ${color === c.value ? "border-slate-800 scale-125" : "border-slate-200"}`}
                  style={{ backgroundColor: c.value }} />
              ))}
            </div>
          )}
        </div>

        <input type="range" min="2" max="20" value={lineWidth}
          onChange={(e) => setLineWidth(Number(e.target.value))}
          title={`Grosor: ${lineWidth}px`} className="w-20 accent-indigo-600" />

        <div className="w-px h-6 bg-slate-200 mx-1" />

        {tool && (
          <button onClick={() => setTool(null)} title="Navegar el libro"
            className="px-2 py-1.5 text-xs rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium">
            Navegar
          </button>
        )}
        <button onClick={clearAll} title="Borrar todas las anotaciones"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-base bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
          🗑️
        </button>
      </div>
    </div>
  );
}
