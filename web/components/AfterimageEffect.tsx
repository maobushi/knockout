"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, RenderPass, AfterimagePass, ShaderPass } from "three-stdlib";
import { useControlsStore } from "@/lib/controlsStore";
import * as THREE from "three";

export default function AfterimageEffect() {
  const { gl, scene, camera, size } = useThree();
  const enabled = useControlsStore((s) => s.afterimageEnabled);
  const damp = useControlsStore((s) => s.afterimageDamp);

  const { composer, afterimagePass, bgClampPass } = useMemo(() => {
    const composerInstance = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const afterPass = new AfterimagePass();
    // 背景の色ズレを抑えるための補正用パス（背景近傍を既定のクリアカラーに固定）
    const clearColor = gl.getClearColor(new THREE.Color()).clone();
    const bgClamp = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        bgColor: { value: new THREE.Color(clearColor.r, clearColor.g, clearColor.b) },
        threshold: { value: 0.010 } // 「若干」の色ズレのみ吸収（必要なら調整）
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 bgColor;
        uniform float threshold;
        varying vec2 vUv;
        void main() {
          vec4 c = texture2D( tDiffuse, vUv );
          // 背景色と近い画素は背景色に固定して残像由来の色偏りを防ぐ
          float d = distance( c.rgb, bgColor );
          vec3 outRgb = (d < threshold) ? bgColor : c.rgb;
          gl_FragColor = vec4( outRgb, 1.0 );
        }
      `
    });
    composerInstance.addPass(renderPass);
    composerInstance.addPass(afterPass);
    composerInstance.addPass(bgClamp);
    composerInstance.setPixelRatio(gl.getPixelRatio());
    composerInstance.setSize(size.width, size.height);
    return { composer: composerInstance, afterimagePass: afterPass, bgClampPass: bgClamp };
    // gl, scene, camera are stable within Canvas lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size]);

  useEffect(() => {
    // 有効/無効はパスの enabled フラグで切替
    (afterimagePass as unknown as { enabled: boolean }).enabled = enabled;
    (bgClampPass as unknown as { enabled: boolean }).enabled = enabled;
  }, [afterimagePass, enabled]);

  useEffect(() => {
    // AfterimagePass exposes uniforms.damp
    // Avoid tight coupling to internal type definitions
    (afterimagePass as unknown as { uniforms: Record<string, { value: number }> }).uniforms["damp"].value = damp;
  }, [afterimagePass, damp]);

  useFrame((_, delta) => {
    // 常に composer で出力し、AfterimagePass の enabled でエフェクト切替
    composer.render(delta);
  }, 1);

  useEffect(() => {
    return () => {
      composer.dispose();
    };
  }, [composer]);

  return null;
}


