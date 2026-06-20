// src/components/MeshViewport.tsx
//
// 3D mesh viewer for item prefabs. Loads FBX from assetDb via Three.js FBXLoader.
// Lazy-loads Three.js so it doesn't bloat the initial bundle.
// Shows the mesh for the currently active node's AssetMesh GUID, falling back
// to the first available mesh if no node is selected.

import React, { useEffect, useRef, useState } from 'react'
import { Cube, CircleNotch, UploadSimple } from 'phosphor-react'
import { assetDb } from '../utils/assetDb'
import type { ComponentNode } from '../types/types'

interface MeshViewportProps {
  meshKeys: Record<string, string>  // fbxAssetGuid → assetDb cache key
  activeNode: ComponentNode | null
}

type ViewportState = 'empty' | 'loading' | 'ready' | 'error'

export default function MeshViewport({ meshKeys, activeNode }: MeshViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [state, setState] = useState<ViewportState>('empty')
  const [errorMsg, setErrorMsg] = useState('')

  // Resolve which FBX GUID to show:
  // - If active node has an AssetMesh property, use that GUID
  // - Otherwise use the first available mesh key
  const resolveTargetGuid = (): string | null => {
    if (activeNode) {
      // AssetMesh may be a number (parsed by parsePrefabGraph) or a string
      const assetMesh = activeNode.properties?.AssetMesh
      if (assetMesh != null) {
        const guidStr = String(assetMesh)
        if (meshKeys[guidStr]) return guidStr
      }
      // Also check ItemMeshReferences on ItemObjectRoot
      const meshRefs = activeNode.properties?.ItemMeshReferences
      if (meshRefs && typeof meshRefs === 'object') {
        for (const key of Object.keys(meshRefs)) {
          const assetMeshVal = meshRefs[key]?.AssetMesh
          if (assetMeshVal != null && meshKeys[String(assetMeshVal)]) {
            return String(assetMeshVal)
          }
        }
      }
    }
    // Fallback: first available mesh
    const guids = Object.keys(meshKeys)
    return guids.length > 0 ? guids[0] : null
  }

  useEffect(() => {
    // Clean up any previous scene
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }

    const targetGuid = resolveTargetGuid()

    if (!targetGuid || !meshKeys[targetGuid]) {
      setState('empty')
      return
    }

    if (!mountRef.current) return

    setState('loading')
    const container = mountRef.current
    let cancelled = false

    const init = async () => {
      try {
        // Load FBX blob from assetDb
        const cacheKey = meshKeys[targetGuid]
        const blob = await assetDb.getFile(cacheKey)
        if (!blob || cancelled) return

        const objectUrl = URL.createObjectURL(blob)

        // Lazy-load Three.js — not in the initial bundle
        const THREE = await import('three')
        const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js')
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')

        if (cancelled) {
          URL.revokeObjectURL(objectUrl)
          return
        }

        const width = container.clientWidth
        const height = container.clientHeight

        // Scene
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x0e1017)

        // Subtle grid floor
        const grid = new THREE.GridHelper(10, 20, 0x1a1f2e, 0x1a1f2e)
        scene.add(grid)

        // Lighting — generous ambient so untextured meshes are always visible
        const ambient = new THREE.AmbientLight(0xffffff, 1.2)
        scene.add(ambient)
        const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 0.8)
        hemi.position.set(0, 20, 0)
        scene.add(hemi)
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5)
        dirLight.position.set(5, 10, 7)
        scene.add(dirLight)
        const fillLight = new THREE.DirectionalLight(0xc8d0e8, 0.6)
        fillLight.position.set(-5, 2, -5)
        scene.add(fillLight)

        // Camera
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000)
        camera.position.set(2, 1.5, 2)

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(width, height)
        renderer.shadowMap.enabled = false
        container.appendChild(renderer.domElement)

        // Orbit controls
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.minDistance = 0.1
        controls.maxDistance = 50

        // Load FBX
        const loader = new FBXLoader()
        loader.load(
          objectUrl,
          (fbx) => {
            if (cancelled) return

            // Normalize scale and center the model
            const box = new THREE.Box3().setFromObject(fbx)
            const size = box.getSize(new THREE.Vector3())
            const maxDim = Math.max(size.x, size.y, size.z)
            const scale = maxDim > 0 ? 2 / maxDim : 1
            fbx.scale.setScalar(scale)

            // Re-center after scale
            const box2 = new THREE.Box3().setFromObject(fbx)
            const center = box2.getCenter(new THREE.Vector3())
            fbx.position.sub(center)
            // Sit on the grid
            const box3 = new THREE.Box3().setFromObject(fbx)
            fbx.position.y -= box3.min.y

            scene.add(fbx)

            // Override materials to neutral gray — FBX embedded materials are often
            // black or missing. Once texture slots are applied this can be toggled off.
            fbx.traverse((child: any) => {
              if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                  color: 0xd0d0d0,
                  roughness: 0.6,
                  metalness: 0.0,
                })
              }
            })

            // Point camera at model
            const box4 = new THREE.Box3().setFromObject(fbx)
            const center4 = box4.getCenter(new THREE.Vector3())
            controls.target.copy(center4)
            camera.position.set(
              center4.x + 2,
              center4.y + 1.5,
              center4.z + 2
            )
            controls.update()

            setState('ready')
          },
          undefined,
          (err) => {
            console.error('[MeshViewport] FBX load error:', err)
            setErrorMsg('Failed to parse FBX file')
            setState('error')
          }
        )

        // Animation loop
        let animId: number
        const animate = () => {
          animId = requestAnimationFrame(animate)
          controls.update()
          renderer.render(scene, camera)
        }
        animate()

        // Resize observer
        const ro = new ResizeObserver(() => {
          if (!container || cancelled) return
          const w = container.clientWidth
          const h = container.clientHeight
          camera.aspect = w / h
          camera.updateProjectionMatrix()
          renderer.setSize(w, h)
        })
        ro.observe(container)

        // Cleanup
        cleanupRef.current = () => {
          cancelled = true
          cancelAnimationFrame(animId)
          ro.disconnect()
          controls.dispose()
          renderer.dispose()
          URL.revokeObjectURL(objectUrl)
          if (renderer.domElement.parentNode === container) {
            container.removeChild(renderer.domElement)
          }
        }

      } catch (err) {
        if (!cancelled) {
          console.error('[MeshViewport] init error:', err)
          setErrorMsg('Could not initialise 3D viewer')
          setState('error')
        }
      }
    }

    init()

    return () => {
      cancelled = true
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  }, [activeNode, JSON.stringify(meshKeys)])

  return (
    <div className="relative w-full h-full bg-[#0e1017] flex flex-col">
      {/* Three.js mount target */}
      <div ref={mountRef} className="flex-1 w-full min-h-0" />

      {/* Overlay states */}
      {state === 'empty' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center pointer-events-none">
          <Cube size={36} weight="thin" className="text-gray-700" />
          <p className="text-xs text-gray-600 max-w-40 leading-relaxed">
            {Object.keys(meshKeys).length === 0
              ? 'No FBX files found in this mod'
              : 'Select a node to preview its mesh'}
          </p>
        </div>
      )}

      {state === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <CircleNotch size={24} className="text-[#8b5cf6] animate-spin" />
          <p className="text-xs text-gray-500">Loading mesh…</p>
        </div>
      )}

      {state === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center pointer-events-none">
          <UploadSimple size={24} weight="thin" className="text-red-400/50" />
          <p className="text-xs text-red-400/70">{errorMsg}</p>
        </div>
      )}

      {/* Corner label */}
      {state === 'ready' && (
        <div className="absolute bottom-2 left-3 pointer-events-none">
          <span className="text-[10px] text-gray-700 font-mono">3D Viewport · Drag to orbit · Scroll to zoom</span>
        </div>
      )}
    </div>
  )
}
