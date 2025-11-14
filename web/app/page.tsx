'use client';

import dynamic from "next/dynamic";

const SceneCanvas = dynamic(() => import("@/components/SceneCanvas"), {
  ssr: false
});
const DebugPanel = dynamic(() => import("@/components/debug/DebugPanel"), {
  ssr: false
});

export default function Page() {
  return (
    <>
      <SceneCanvas />
      <DebugPanel />
    </>
  );
}
