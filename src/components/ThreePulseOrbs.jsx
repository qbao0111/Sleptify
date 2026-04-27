import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ThreePulseOrbs({ isPlaying = false }) {
  const mountRef = useRef(null);
  const playingTargetRef = useRef(isPlaying ? 1 : 0);

  useEffect(() => {
    playingTargetRef.current = isPlaying ? 1 : 0;
  }, [isPlaying]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 12);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    group.position.set(1.8, -0.7, 0);
    scene.add(group);

    const ringMaterialA = new THREE.MeshBasicMaterial({
      color: 0x5cf4d2,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const ringMaterialB = new THREE.MeshBasicMaterial({
      color: 0x64b8ff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const torusA = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.05, 20, 130), ringMaterialA);
    torusA.rotation.set(1.08, 0.25, 0.05);
    group.add(torusA);

    const torusB = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.04, 20, 120), ringMaterialB);
    torusB.rotation.set(0.78, -0.4, 0.1);
    group.add(torusB);

    const particleCount = 520;
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 1.7 + Math.random() * 2.8;
      const sinPhi = Math.sin(phi);
      const base = i * 3;

      positions[base] = radius * sinPhi * Math.cos(theta);
      positions[base + 1] = radius * sinPhi * Math.sin(theta);
      positions[base + 2] = (Math.random() - 0.5) * 2.8;
      scales[i] = 0.3 + Math.random() * 1.6;
    }

    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));

    const particlesMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: playingTargetRef.current },
      },
      vertexShader: `
        attribute float aScale;
        uniform float uTime;
        uniform float uIntensity;

        void main() {
          vec3 p = position;
          float wobble = sin(uTime * 0.45 + p.x * 0.9 + p.y * 0.6) * 0.12;
          p *= 1.0 + wobble * (0.45 + uIntensity * 0.7);

          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = (1.4 + aScale * 1.9) * (1.0 + uIntensity * 0.35);
          gl_PointSize *= 11.0 / -mvPosition.z;
        }
      `,
      fragmentShader: `
        uniform float uIntensity;

        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float alpha = smoothstep(0.5, 0.02, d);

          vec3 cA = vec3(0.36, 0.96, 0.86);
          vec3 cB = vec3(0.42, 0.72, 1.00);
          vec3 color = mix(cA, cB, clamp(gl_PointCoord.y + uIntensity * 0.35, 0.0, 1.0));

          gl_FragColor = vec4(color, alpha * (0.55 + uIntensity * 0.35));
        }
      `,
    });

    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    group.add(particles);

    const clock = new THREE.Clock();
    let frameId = 0;
    let intensity = playingTargetRef.current;

    const onResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };

    window.addEventListener("resize", onResize);

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      intensity += (playingTargetRef.current - intensity) * 0.045;
      particlesMaterial.uniforms.uTime.value = t;
      particlesMaterial.uniforms.uIntensity.value = intensity;

      group.rotation.y = t * (0.08 + intensity * 0.08);
      group.rotation.x = Math.sin(t * 0.21) * 0.08;

      const orbit = 1 + Math.sin(t * 0.8) * 0.018 + intensity * 0.045;
      torusA.scale.setScalar(orbit);
      torusB.scale.setScalar(1.03 - Math.sin(t * 0.6) * 0.014 + intensity * 0.025);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);

      torusA.geometry.dispose();
      torusB.geometry.dispose();
      ringMaterialA.dispose();
      ringMaterialB.dispose();
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="orb-canvas" aria-hidden="true" />;
}
