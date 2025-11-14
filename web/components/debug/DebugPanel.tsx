"use client";
import { useEffect, useState } from "react";
import { useControlsStore } from "@/lib/controlsStore";
import type { Direction, EventMessage } from "@/types/events";
import { getSocket } from "@/lib/socket-client";

const DIRS: Direction[] = ["N", "E", "S", "W"];

export default function DebugPanel() {
  const [open, setOpen] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const {
    lineWidth, setLineWidth,
    danmakuSpeed, setDanmakuSpeed,
    danmakuTTL, setDanmakuTTL,
    danmakuFontSize, setDanmakuFontSize,
    danmakuColor, setDanmakuColor,
    danmakuMaxCount, setDanmakuMaxCount,
    cameraAngularSpeed, setCameraAngularSpeed
  } = useControlsStore();

  const [dir, setDir] = useState<Direction>("E");
  const [row, setRow] = useState(4);
  const [col, setCol] = useState(3);
  const [text, setText] = useState("押忍");
  const [color, setColor] = useState("#ff3b30");

  useEffect(() => {
    const socket = getSocket();
    setWsConnected(socket.connected);
    const onConnect = () => setWsConnected(true);
    const onDisconnect = () => setWsConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  const sendSample = async () => {
    const socket = getSocket();
    if (!socket.connected) {
      // 接続を待ってから送信（最大1.5秒）
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => resolve(), 1500);
        socket.once("connect", () => {
          clearTimeout(t);
          resolve();
        });
      });
    }
    const payload: EventMessage = {
      seat: { dir, row, col },
      text,
      color
    };
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  };

  return (
    <div style={{
      position: "fixed",
      right: 12,
      bottom: 12,
      width: 320,
      background: "rgba(20,20,20,0.9)",
      border: "1px solid #333",
      borderRadius: 8,
      padding: 12,
      fontSize: 12,
      lineHeight: 1.4,
      zIndex: 100
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Debug</strong>
        <span style={{ fontSize: 11, color: wsConnected ? "#4ade80" : "#fca5a5" }}>
          {wsConnected ? "WS: connected" : "WS: connecting..."}
        </span>
        <button onClick={() => setOpen((v) => !v)} style={{ background: "#222", color: "#fff", border: "1px solid #555", borderRadius: 4, padding: "4px 8px", cursor: "pointer" }}>
          {open ? "hide" : "show"}
        </button>
      </div>
      {!open ? null : (
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          <section>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Camera</div>
            <label>angular speed: {cameraAngularSpeed.toFixed(3)}</label>
            <input type="range" min="0.01" max="0.4" step="0.005" value={cameraAngularSpeed} onChange={(e) => setCameraAngularSpeed(parseFloat(e.target.value))} style={{ width: "100%" }} />
          </section>
          <section>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Ring/Grid</div>
            <label>line width: {lineWidth.toFixed(1)}</label>
            <input type="range" min="1" max="8" step="0.1" value={lineWidth} onChange={(e) => setLineWidth(parseFloat(e.target.value))} style={{ width: "100%" }} />
          </section>
          <section>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Danmaku</div>
            <label>speed: {danmakuSpeed.toFixed(2)}</label>
            <input type="range" min="0.2" max="4" step="0.05" value={danmakuSpeed} onChange={(e) => setDanmakuSpeed(parseFloat(e.target.value))} style={{ width: "100%" }} />
            <label>ttl: {danmakuTTL.toFixed(1)}s</label>
            <input type="range" min="2" max="20" step="0.5" value={danmakuTTL} onChange={(e) => setDanmakuTTL(parseFloat(e.target.value))} style={{ width: "100%" }} />
            <label>font size: {danmakuFontSize.toFixed(2)}</label>
            <input type="range" min="0.3" max="1.5" step="0.05" value={danmakuFontSize} onChange={(e) => setDanmakuFontSize(parseFloat(e.target.value))} style={{ width: "100%" }} />
            <label>default color</label>
            <input type="color" value={danmakuColor} onChange={(e) => setDanmakuColor(e.target.value)} />
            <label>max count: {danmakuMaxCount}</label>
            <input type="range" min="50" max="1000" step="10" value={danmakuMaxCount} onChange={(e) => setDanmakuMaxCount(parseInt(e.target.value))} style={{ width: "100%" }} />
          </section>
          <section>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Send Sample</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              <select value={dir} onChange={(e) => setDir(e.target.value as Direction)}>
                {DIRS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input type="number" min={0} max={9} value={row} onChange={(e) => setRow(parseInt(e.target.value) || 0)} />
              <input type="number" min={0} max={9} value={col} onChange={(e) => setCol(parseInt(e.target.value) || 0)} />
            </div>
            <input style={{ width: "100%", marginTop: 6 }} value={text} onChange={(e) => setText(e.target.value)} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <label>color</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              <button onClick={sendSample} disabled={!wsConnected} style={{ marginLeft: "auto", opacity: wsConnected ? 1 : 0.6, background: "#2b6", color: "#fff", border: "1px solid #1a4", borderRadius: 4, padding: "4px 8px", cursor: wsConnected ? "pointer" : "not-allowed" }}>
                POST /api/events
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}


