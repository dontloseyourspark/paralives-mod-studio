// src/components/MeshViewport.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { ComponentNode } from '../types/types'
import type { Item } from '../types/types'
import { itemTextureCacheKey } from '../lib/itemTextureSlots'
import type { ItemMeshTextureSlot } from '../lib/itemTextureSlots'
// Type-only import — erased at compile time, so it doesn't pull `three` into
// the eagerly-loaded bundle. The runtime value still only ever comes from the
// dynamic `await import('three')` calls inside each effect (lazy-loaded).
// This is purely so `THREE.Mesh`/`THREE.Group`/etc. can be used as types in
// places (e.g. the mode-application effect) that don't do their own dynamic
// import and so have no in-scope runtime `THREE` value to reference.
import type * as THREE from 'three'

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewportMode = 'clay' | 'textured' | 'wireframe'

interface MeshViewportProps {
  meshKeys: Record<string, string>
  activeNode: ComponentNode | null
  item: Item | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve which assetDb cache key to load as the FBX mesh.
 * Priority: activeNode.AssetMesh → first key in meshKeys → null
 */
function resolveMeshCacheKey(
  meshKeys: Record<string, string>,
  activeNode: ComponentNode | null,
): string | null {
  if (activeNode) {
    const assetMesh = activeNode.properties?.AssetMesh
    if (assetMesh != null) {
      const guidStr = String(assetMesh)
      const found = meshKeys[guidStr]
      if (found) return found
    }

    // Also check ItemMeshReferences sub-entries
    const imr = activeNode.properties?.ItemMeshReferences
    if (imr && typeof imr === 'object' && !Array.isArray(imr)) {
      for (const val of Object.values(imr)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          const subMesh = (val as Record<string, unknown>).AssetMesh
          if (subMesh != null) {
            const found = meshKeys[String(subMesh)]
            if (found) return found
          }
        }
      }
    }
  }

  const firstKey = Object.values(meshKeys)[0]
  return firstKey ?? null
}

/**
 * Find the first texture slot that has a bound GUID for the active node.
 *
 * Texture properties (DetailMap, ColorZoneMap, etc.) live exclusively on the
 * ItemMeshReference component. The activeNode passed from WorkspaceCanvas may
 * be any component type (ItemObjectRoot, ItemCubeTransform, ItemMeshReference).
 * We search item.components for the ItemMeshReference that shares the same
 * node id as activeNode, then check its properties.
 */
function resolveTextureCacheKey(
  item: Item | null,
  activeNode: ComponentNode | null,
): { cacheKey: string; slot: ItemMeshTextureSlot } | null {
  if (!item || !activeNode) return null

  // Find the ItemMeshReference component for this node id
  const meshRefNode = item.components.find(
    (c) => c.id === activeNode.id && c.type === 'ItemMeshReference'
  ) ?? (activeNode.type === 'ItemMeshReference' ? activeNode : null)

  if (!meshRefNode) return null

  const priority: ItemMeshTextureSlot[] = ['DetailMap', 'ColorZoneMap', 'DecalMap', 'DirtyOverlay']
  for (const slot of priority) {
    const val = meshRefNode.properties?.[slot]
    if (val != null) {
      return { cacheKey: itemTextureCacheKey(item.guid, slot), slot }
    }
  }
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MeshViewport({ meshKeys, activeNode, item }: MeshViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)

  // Cleanup function stored in a ref so it's always current
  const cleanupRef = useRef<(() => void) | null>(null)

  // Refs for live Three.js objects — used by texture effect without re-triggering mesh effect
  const meshGroupRef      = useRef<unknown>(null)  // THREE.Group holding the loaded FBX
  const rendererRef       = useRef<unknown>(null)  // THREE.WebGLRenderer
  const sceneRef          = useRef<unknown>(null)  // THREE.Scene
  const textureUrlRef     = useRef<string | null>(null)  // current blob URL to revoke on cleanup
  const viewportReadyRef  = useRef(false)           // sync flag — avoids stale closure in texture effect

  const [viewportState, setViewportState] = useState<'empty' | 'loading' | 'ready' | 'error'>('empty')
  const [mode, setMode] = useState<ViewportMode>('clay')

  // textureInfo is pure-derivable from props, so it's computed during render
  // rather than re-derived inside the effect — that's what lets hasTexture
  // below avoid ever needing a setState call just to say "nothing to load".
  const textureInfo = resolveTextureCacheKey(item, activeNode)

  // loadedTextureKey tracks which cacheKey actually finished loading into the
  // live Three.js group. hasTexture is derived by comparing it against the
  // *current* textureInfo — so switching to a node with no texture, or one
  // whose texture hasn't loaded yet, correctly reads as false without any
  // effect needing to reset it.
  const [loadedTextureKey, setLoadedTextureKey] = useState<string | null>(null)
  const hasTexture = !!textureInfo && loadedTextureKey === textureInfo.cacheKey

  // ── Mesh initialisation effect ────────────────────────────────────────────
  // Fires when the target mesh changes. Tears down and rebuilds the whole
  // Three.js scene. Does NOT handle texture — that's a separate effect.

  useEffect(() => {
    const cacheKey = resolveMeshCacheKey(meshKeys, activeNode)

    if (!cacheKey || !canvasRef.current || !containerRef.current) {
      setViewportState('empty')
      return
    }

    // Tear down previous scene
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }

    // Reset texture state when mesh changes
    if (textureUrlRef.current) {
      URL.revokeObjectURL(textureUrlRef.current)
      textureUrlRef.current = null
    }
    setLoadedTextureKey(null)
    setMode('clay')
    viewportReadyRef.current = false

    setViewportState('loading')

    let cancelled = false

    ;(async () => {
      try {
        const [THREE, { FBXLoader }, { OrbitControls }, { assetDb }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/loaders/FBXLoader.js'),
          import('three/examples/jsm/controls/OrbitControls.js'),
          import('../utils/assetDb'),
        ])

        if (cancelled) return

        // Load raw FBX bytes
        const blob = await assetDb.getFile(cacheKey)
        if (!blob || cancelled) return

        const arrayBuffer = await blob.arrayBuffer()
        if (cancelled) return

        // ── Scene setup ──────────────────────────────────────────────────
        const canvas    = canvasRef.current!
        const container = containerRef.current!
        const w = container.clientWidth
        const h = container.clientHeight

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
        renderer.setSize(w, h)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.shadowMap.enabled = false

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x1a1a1a)

        // Grid
        const grid = new THREE.GridHelper(20, 40, 0x333333, 0x2a2a2a)
        scene.add(grid)

        // Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.6)
        scene.add(ambient)
        const key = new THREE.DirectionalLight(0xffffff, 1.2)
        key.position.set(5, 8, 5)
        scene.add(key)
        const fill = new THREE.DirectionalLight(0xffffff, 0.4)
        fill.position.set(-5, 3, -5)
        scene.add(fill)

        const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1000)

        // ── Parse FBX ────────────────────────────────────────────────────
        const loader = new FBXLoader()
        const fbxGroup = loader.parse(arrayBuffer, '')
        if (cancelled) { renderer.dispose(); return }

        // Apply gray material to every mesh
        const clayMat = new THREE.MeshStandardMaterial({
          color: 0x999999,
          roughness: 0.7,
          metalness: 0.0,
        })

        fbxGroup.traverse((child: unknown) => {
          const mesh = child as THREE.Mesh
          if (mesh.isMesh) {
            mesh.material = clayMat
            mesh.castShadow    = false
            mesh.receiveShadow = false
          }
        })

        // Auto-center and fit camera
        const box    = new THREE.Box3().setFromObject(fbxGroup)
        const center = box.getCenter(new THREE.Vector3())
        const size   = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale  = maxDim > 0 ? 2 / maxDim : 1

        fbxGroup.position.sub(center.multiplyScalar(scale))
        fbxGroup.scale.setScalar(scale)

        // Re-check bounds after scale for camera placement
        const scaledBox    = new THREE.Box3().setFromObject(fbxGroup)
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3())
        const scaledSize   = scaledBox.getSize(new THREE.Vector3())
        const scaledMax    = Math.max(scaledSize.x, scaledSize.y, scaledSize.z)

        camera.position.set(
          scaledCenter.x + scaledMax * 1.2,
          scaledCenter.y + scaledMax * 0.8,
          scaledCenter.z + scaledMax * 1.5,
        )
        camera.lookAt(scaledCenter)

        scene.add(fbxGroup)

        // Store refs for texture effect
        meshGroupRef.current = fbxGroup
        rendererRef.current  = renderer
        sceneRef.current     = scene

        // ── Controls ─────────────────────────────────────────────────────
        const controls = new OrbitControls(camera, canvas)
        controls.target.copy(scaledCenter)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.update()

        // ── Render loop ──────────────────────────────────────────────────
        let rafId: number
        const animate = () => {
          rafId = requestAnimationFrame(animate)
          controls.update()
          renderer.render(scene, camera)
        }
        animate()

        // ── Resize observer ──────────────────────────────────────────────
        const ro = new ResizeObserver(() => {
          if (!container || !renderer) return
          const nw = container.clientWidth
          const nh = container.clientHeight
          camera.aspect = nw / nh
          camera.updateProjectionMatrix()
          renderer.setSize(nw, nh)
        })
        ro.observe(container)

        if (!cancelled) {
          viewportReadyRef.current = true
          setViewportState('ready')
        }

        // ── Cleanup ──────────────────────────────────────────────────────
        cleanupRef.current = () => {
          cancelled = true
          cancelAnimationFrame(rafId)
          ro.disconnect()
          controls.dispose()
          renderer.dispose()
          clayMat.dispose()
          meshGroupRef.current = null
          rendererRef.current  = null
          sceneRef.current     = null
          viewportReadyRef.current = false
        }

      } catch (err) {
        if (!cancelled) {
          console.error('[MeshViewport] FBX load error:', err)
          setViewportState('error')
        }
      }
    })()

    return () => {
      cancelled = true
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(meshKeys), activeNode?.id])

  // ── Texture loading effect ────────────────────────────────────────────────
  // Fires when activeNode or item changes. Uses viewportReadyRef (not
  // viewportState) so it always reads the current ready status synchronously
  // rather than a potentially stale React state value.

  useEffect(() => {
    if (!viewportReadyRef.current) return

    // Clean up previous texture URL
    if (textureUrlRef.current) {
      URL.revokeObjectURL(textureUrlRef.current)
      textureUrlRef.current = null
    }

    // Nothing to load for this node — hasTexture already derives to false
    // above since loadedTextureKey can't match a null textureInfo.
    if (!textureInfo) return

    let cancelled = false

    ;(async () => {
      try {
        const [THREE, { assetDb }] = await Promise.all([
          import('three'),
          import('../utils/assetDb'),
        ])

        const blob = await assetDb.getFile(textureInfo.cacheKey)
        if (!blob || cancelled) return

        const url = URL.createObjectURL(blob)
        textureUrlRef.current = url

        const texture = await new THREE.TextureLoader().loadAsync(url)
        if (cancelled) {
          texture.dispose()
          URL.revokeObjectURL(url)
          textureUrlRef.current = null
          return
        }

        // FBX UV coordinates are top-down; Three.js defaults to bottom-up.
        // flipY = false corrects the vertical flip.
        texture.flipY = false
        texture.colorSpace = THREE.SRGBColorSpace

        // Store texture on the group so the mode toggle can reference it
        const group = meshGroupRef.current as (THREE.Group & { _loadedTexture?: THREE.Texture }) | null
        if (!group) return

        // Dispose previous loaded texture if any
        if (group._loadedTexture) {
          group._loadedTexture.dispose()
        }
        group._loadedTexture = texture

        if (!cancelled) {
          setLoadedTextureKey(textureInfo.cacheKey)
          setMode('textured')  // auto-switch to textured once loaded
        }

      } catch (err) {
        if (!cancelled) {
          console.error('[MeshViewport] Texture load error:', err)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportState, activeNode?.id, item?.guid, textureInfo?.cacheKey])

  // ── Mode application effect ───────────────────────────────────────────────
  // Whenever mode changes, walk the mesh group and update every mesh's material.

  useEffect(() => {
    const group = meshGroupRef.current as (THREE.Group & { _loadedTexture?: THREE.Texture }) | null
    if (!group) return

    group.traverse((child: unknown) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return

      const mat = mesh.material as THREE.MeshStandardMaterial
      if (!mat) return

      if (mode === 'wireframe') {
        mat.wireframe = true
        mat.map = null
        mat.needsUpdate = true
      } else if (mode === 'textured' && group._loadedTexture) {
        mat.wireframe = false
        mat.map = group._loadedTexture
        mat.needsUpdate = true
      } else {
        // clay
        mat.wireframe = false
        mat.map = null
        mat.needsUpdate = true
      }
    })
  }, [mode])

  // ── Texture URL cleanup on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (textureUrlRef.current) {
        URL.revokeObjectURL(textureUrlRef.current)
        textureUrlRef.current = null
      }
    }
  }, [])

  // ── Mode toggle handler ───────────────────────────────────────────────────
  const cycleMode = useCallback((next: ViewportMode) => {
    setMode(next)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  const hasMesh = Object.keys(meshKeys).length > 0

  return (
    <div className="relative w-full h-full bg-[#1a1a1a] flex flex-col overflow-hidden">

      {/* Three.js canvas — always mounted so the ref is stable */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: viewportState === 'ready' ? 'block' : 'none' }}
      />

      {/* Container div used for ResizeObserver and layout.
          pointer-events-none so mouse events reach the canvas for OrbitControls. */}
      <div ref={containerRef} className="absolute inset-0 pointer-events-none" />

      {/* ── Overlays ── */}

      {viewportState === 'empty' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-gray-600">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
            <p className="text-[11px]">{hasMesh ? 'Select a node to preview' : 'No mesh imported'}</p>
          </div>
        </div>
      )}

      {viewportState === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <div className="w-5 h-5 border-2 border-gray-600 border-t-gray-400 rounded-full animate-spin" />
            <p className="text-[11px]">Loading mesh…</p>
          </div>
        </div>
      )}

      {viewportState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-red-500/60">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-[11px]">Failed to parse FBX</p>
          </div>
        </div>
      )}

      {/* ── Mode toggle toolbar (only visible when mesh is ready) ── */}
      {viewportState === 'ready' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg p-1 z-10">
          <ModeButton
            label="Clay"
            active={mode === 'clay'}
            onClick={() => cycleMode('clay')}
          />
          <ModeButton
            label="Textured"
            active={mode === 'textured'}
            disabled={!hasTexture}
            onClick={() => hasTexture && cycleMode('textured')}
            title={hasTexture ? 'Show texture' : 'No texture uploaded for this node'}
          />
          <ModeButton
            label="Wire"
            active={mode === 'wireframe'}
            onClick={() => cycleMode('wireframe')}
          />
        </div>
      )}
    </div>
  )
}

// ── Mode button ───────────────────────────────────────────────────────────────

interface ModeButtonProps {
  label: string
  active: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
}

function ModeButton({ label, active, disabled = false, onClick, title }: ModeButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={[
        'px-2.5 py-1 rounded-md text-[10px] font-medium tracking-wide transition-colors',
        active
          ? 'bg-white/15 text-white'
          : disabled
            ? 'text-gray-600 cursor-not-allowed'
            : 'text-gray-400 hover:text-gray-200 hover:bg-white/8',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

export default MeshViewport
