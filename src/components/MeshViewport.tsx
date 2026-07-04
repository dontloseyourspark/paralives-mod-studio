// src/components/MeshViewport.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Perspective, Cube, Circle, CircleDashed, Image as ImageIcon,
  Sun, SunDim, Flashlight, Diamond,
} from 'phosphor-react'
import type { Icon as PhosphorIcon } from 'phosphor-react'
import type { ComponentNode } from '../types/types'
import type { Item } from '../types/types'
import { itemTextureCacheKey } from '../lib/itemTextureSlots'
import type { ItemMeshTextureSlot } from '../lib/itemTextureSlots'
// Type-only imports — erased at compile time, so they don't pull `three` (or the
// examples/jsm helpers) into the eagerly-loaded bundle. The runtime values still
// only ever come from the dynamic `await import(...)` calls inside the setup
// effect (lazy-loaded). These are purely so the ref types and handler bodies can
// name `THREE.*`, `OrbitControls`, and `ViewHelper` without an eager import.
import type * as THREE from 'three'
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ViewHelper as ViewHelperType } from 'three/examples/jsm/helpers/ViewHelper.js'

type ViewHelperCtor = typeof import('three/examples/jsm/helpers/ViewHelper.js')['ViewHelper']
type AnyCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewportMode = 'clay' | 'textured' | 'wireframe'
type Projection = 'perspective' | 'orthographic'
type AxisView = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom'

interface MeshViewportProps {
  meshKeys: Record<string, string>
  activeNode: ComponentNode | null
  item: Item | null
  onSave?: (updatedItem: Item) => void
}

// ── Constants ───────────────────────────────────────────────────────────────

// Camera framing: the mesh is auto-scaled so its longest dimension ≈ FRAME_SIZE.
// Orbit distance and ortho frustum are derived from this.
const ORTHO_HALF_HEIGHT_FACTOR = 0.8   // ortho view half-height as a multiple of frame size
const VIEW_DISTANCE_FACTOR = 4         // axis-snap camera distance as a multiple of frame size

// Direction the camera sits (relative to the mesh centre) + its up vector, per
// axis view. Y-up world (three.js default after FBX import). Top/Bottom use a
// Z up-vector to avoid a degenerate look-straight-down orientation.
const AXIS_VIEWS: Record<AxisView, { dir: [number, number, number]; up: [number, number, number] }> = {
  front:  { dir: [0, 0, 1],  up: [0, 1, 0] },
  back:   { dir: [0, 0, -1], up: [0, 1, 0] },
  right:  { dir: [1, 0, 0],  up: [0, 1, 0] },
  left:   { dir: [-1, 0, 0], up: [0, 1, 0] },
  top:    { dir: [0, 1, 0],  up: [0, 0, -1] },
  bottom: { dir: [0, -1, 0], up: [0, 0, 1] },
}

// Lighting presets. `env` scales the RoomEnvironment image-based "world light"
// (scene.environmentIntensity) — this is what keeps surfaces facing away from the
// directional lights from going black. ambient/key/fill are the three-point rig.
// Values are tuned for three.js's physically-correct lighting (r155+), where the
// old-style low intensities render very dark.
const LIGHTING_PRESETS = {
  studio:   { label: 'Studio',   env: 1.0,  ambient: 0.4, key: 2.8, fill: 0.9 },
  soft:     { label: 'Soft',     env: 1.4,  ambient: 0.8, key: 1.2, fill: 0.7 },
  dramatic: { label: 'Dramatic', env: 0.35, ambient: 0.1, key: 4.5, fill: 0.15 },
  flat:     { label: 'Flat',     env: 1.7,  ambient: 1.6, key: 0.0, fill: 0.0 },
} as const
type LightingPreset = keyof typeof LIGHTING_PRESETS

// Icon per lighting preset — mirrors the intensity/character of the rig above
// (Sun = balanced studio, SunDim = soft/diffused, Flashlight = single dramatic
// key light, Diamond = flat/shadeless).
const LIGHTING_ICONS: Record<LightingPreset, PhosphorIcon> = {
  studio: Sun,
  soft: SunDim,
  dramatic: Flashlight,
  flat: Diamond,
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
  // meshKeys is keyed by assetGuid string (from fbx.meta).
  // AssetMesh on the node is also a raw string (stored without parseFloat in the parser).
  // Use a prefix-match fallback for any residual precision loss.
  const findByGuid = (guid: string): string | null => {
    if (meshKeys[guid]) return meshKeys[guid]
    const prefix = guid.substring(0, 13)
    const match = Object.keys(meshKeys).find(k => k.startsWith(prefix))
    return match ? meshKeys[match] : null
  }

  if (activeNode) {
    const assetMesh = activeNode.properties?.AssetMesh
    if (assetMesh != null) {
      const found = findByGuid(String(assetMesh))
      if (found) return found
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

export function MeshViewport({ meshKeys, activeNode, item, onSave }: MeshViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const handleImportMesh = async (file: File) => {
    if (!item || !activeNode || !onSave) return
    setImportError(null)
    setImporting(true)
    try {
      const { importMeshForNode } = await import('../lib/meshImport')
      onSave(await importMeshForNode(item, activeNode, file))
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import this mesh.')
    } finally {
      setImporting(false)
    }
  }

  // Cleanup function stored in a ref so it's always current
  const cleanupRef = useRef<(() => void) | null>(null)

  // Refs for live Three.js objects — used by texture/mode/lighting effects and
  // by the camera/lighting button handlers without re-triggering the setup effect.
  const meshGroupRef       = useRef<unknown>(null)               // THREE.Group holding the loaded FBX
  const rendererRef        = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef           = useRef<THREE.Scene | null>(null)
  const cameraRef          = useRef<AnyCamera | null>(null)      // active camera (persp or ortho)
  const controlsRef        = useRef<OrbitControlsType | null>(null)
  const viewHelperRef      = useRef<ViewHelperType | null>(null) // corner axis gizmo
  const viewHelperCtorRef  = useRef<ViewHelperCtor | null>(null)
  const threeRef           = useRef<typeof import('three') | null>(null)
  const frameRef           = useRef<{ center: THREE.Vector3; size: number } | null>(null)
  const ambientRef         = useRef<THREE.AmbientLight | null>(null)
  const keyLightRef        = useRef<THREE.DirectionalLight | null>(null)
  const fillLightRef       = useRef<THREE.DirectionalLight | null>(null)
  const textureUrlRef      = useRef<string | null>(null)         // current blob URL to revoke on cleanup
  const viewportReadyRef   = useRef(false)                       // sync flag — avoids stale closure in texture effect

  const [viewportState, setViewportState] = useState<'empty' | 'loading' | 'ready' | 'error'>('empty')
  const [mode, setMode] = useState<ViewportMode>('clay')
  const [projection, setProjectionState] = useState<Projection>('perspective')
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('studio')

  // Kept in a ref so the setup effect can read the current lighting choice
  // without depending on it (lighting should persist across mesh changes).
  // Updated in an effect (not during render) to avoid mutating a ref in the
  // render phase.
  const lightingPresetRef = useRef(lightingPreset)
  useEffect(() => { lightingPresetRef.current = lightingPreset }, [lightingPreset])

  // textureInfo is pure-derivable from props, so it's computed during render
  // rather than re-derived inside the effect — that's what lets hasTexture
  // below avoid ever needing a setState call just to say "nothing to load".
  const textureInfo = resolveTextureCacheKey(item, activeNode)

  // loadedTextureKey tracks which cacheKey actually finished loading into the
  // live Three.js group. hasTexture is derived by comparing it against the
  // *current* textureInfo.
  const [loadedTextureKey, setLoadedTextureKey] = useState<string | null>(null)
  const hasTexture = !!textureInfo && loadedTextureKey === textureInfo.cacheKey

  // ── Rebuild the corner gizmo bound to a (possibly new) camera ───────────────
  // ViewHelper captures its camera in a closure, so a projection swap needs a
  // fresh instance rather than a re-target.
  const rebuildViewHelper = useCallback((cam: AnyCamera) => {
    const Ctor = viewHelperCtorRef.current
    const controls = controlsRef.current
    const canvas = canvasRef.current
    if (!Ctor || !controls || !canvas) return
    viewHelperRef.current?.dispose()
    const vh = new Ctor(cam, canvas)
    vh.setLabels('X', 'Y', 'Z')
    vh.center = controls.target
    viewHelperRef.current = vh
  }, [])

  // ── Switch camera projection (perspective ↔ orthographic) ───────────────────
  const changeProjection = useCallback((next: Projection) => {
    const THREE = threeRef.current
    const controls = controlsRef.current
    const oldCam = cameraRef.current
    const container = containerRef.current
    if (!THREE || !controls || !oldCam || !container) return

    const aspect = container.clientWidth / Math.max(1, container.clientHeight)
    const isPersp = oldCam.type === 'PerspectiveCamera'

    if (next === 'orthographic' && isPersp) {
      const frame = frameRef.current!
      const H = frame.size * ORTHO_HALF_HEIGHT_FACTOR
      const cam = new THREE.OrthographicCamera(-H * aspect, H * aspect, H, -H, 0.01, 1000)
      cam.position.copy(oldCam.position)
      cam.up.copy(oldCam.up)
      cam.quaternion.copy(oldCam.quaternion)
      cameraRef.current = cam
      controls.object = cam
      controls.enableRotate = false  // ortho: pan + zoom only, like Blender's locked ortho views
      rebuildViewHelper(cam)
      controls.update()
      setProjectionState('orthographic')
    } else if (next === 'perspective' && !isPersp) {
      const cam = new THREE.PerspectiveCamera(45, aspect, 0.01, 1000)
      cam.position.copy(oldCam.position)
      cam.up.copy(oldCam.up)
      cam.quaternion.copy(oldCam.quaternion)
      cameraRef.current = cam
      controls.object = cam
      controls.enableRotate = true
      rebuildViewHelper(cam)
      controls.update()
      setProjectionState('perspective')
    }
  }, [rebuildViewHelper])

  // ── Snap to an orthographic axis view (Front / Right / Top / …) ─────────────
  const setAxisView = useCallback((axis: AxisView) => {
    if (cameraRef.current?.type === 'PerspectiveCamera') changeProjection('orthographic')
    const cam = cameraRef.current
    const controls = controlsRef.current
    const frame = frameRef.current
    if (!cam || !controls || !frame) return

    const { dir, up } = AXIS_VIEWS[axis]
    const d = frame.size * VIEW_DISTANCE_FACTOR
    controls.target.copy(frame.center)
    cam.up.set(up[0], up[1], up[2])
    cam.position.set(
      frame.center.x + dir[0] * d,
      frame.center.y + dir[1] * d,
      frame.center.z + dir[2] * d,
    )
    cam.lookAt(frame.center)
    controls.update()
  }, [changeProjection])

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

    // Reset texture + view state when mesh changes
    if (textureUrlRef.current) {
      URL.revokeObjectURL(textureUrlRef.current)
      textureUrlRef.current = null
    }
    setLoadedTextureKey(null)
    setMode('clay')
    setProjectionState('perspective')
    viewportReadyRef.current = false

    setViewportState('loading')

    let cancelled = false

    ;(async () => {
      try {
        const [THREE, { FBXLoader }, { OrbitControls }, { ViewHelper }, { RoomEnvironment }, { assetDb }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/loaders/FBXLoader.js'),
          import('three/examples/jsm/controls/OrbitControls.js'),
          import('three/examples/jsm/helpers/ViewHelper.js'),
          import('three/examples/jsm/environments/RoomEnvironment.js'),
          import('../utils/assetDb'),
        ])

        if (cancelled) return

        // Load raw FBX bytes
        const blob = await assetDb.getFile(cacheKey)
        if (cancelled) return
        if (!blob) {
          // The node references a mesh asset that isn't in assetDb (e.g. a
          // dangling AssetMesh GUID in the source mod, or a deleted blob).
          // Surface this as an error instead of leaving the spinner stuck
          // on "Loading mesh…" forever.
          console.error('[MeshViewport] No stored blob for mesh cache key:', cacheKey)
          setViewportState('error')
          return
        }

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
        // ViewHelper.render() calls renderer.render() for the corner gizmo, which
        // would wipe the main scene if autoClear were on. Disable it and clear
        // manually once per frame before the main render instead.
        renderer.autoClear = false

        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x1a1a1a)

        // Image-based "world light" — three.js's neutral studio RoomEnvironment,
        // baked once via PMREM. This is what stops surfaces facing away from the
        // directional lights from going black under physically-correct lighting.
        // Does NOT change the (dark) background — only how the mesh is lit.
        const pmrem = new THREE.PMREMGenerator(renderer)
        const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
        scene.environment = envTexture
        pmrem.dispose()

        // Grid
        const grid = new THREE.GridHelper(20, 40, 0x333333, 0x2a2a2a)
        scene.add(grid)

        // Lights — intensities set below from the active preset
        const preset = LIGHTING_PRESETS[lightingPresetRef.current]
        scene.environmentIntensity = preset.env
        const ambient = new THREE.AmbientLight(0xffffff, preset.ambient)
        scene.add(ambient)
        const keyLight = new THREE.DirectionalLight(0xffffff, preset.key)
        keyLight.position.set(5, 8, 5)
        scene.add(keyLight)
        const fillLight = new THREE.DirectionalLight(0xffffff, preset.fill)
        fillLight.position.set(-5, 3, -5)
        scene.add(fillLight)

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

        // Store refs (order matters: rebuildViewHelper reads controls/canvas/ctor)
        meshGroupRef.current     = fbxGroup
        rendererRef.current      = renderer
        sceneRef.current         = scene
        cameraRef.current        = camera
        threeRef.current         = THREE
        viewHelperCtorRef.current = ViewHelper
        frameRef.current         = { center: scaledCenter.clone(), size: scaledMax }
        ambientRef.current       = ambient
        keyLightRef.current      = keyLight
        fillLightRef.current     = fillLight

        // ── Controls ─────────────────────────────────────────────────────
        const controls = new OrbitControls(camera, canvas)
        controls.target.copy(scaledCenter)
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        controls.enableRotate = true
        controls.update()
        controlsRef.current = controls

        // ── Corner axis gizmo ────────────────────────────────────────────
        rebuildViewHelper(camera)

        // ── Gizmo click handling (with a small drag threshold so orbiting
        //    doesn't accidentally trigger a snap) ─────────────────────────
        let downX = 0, downY = 0
        const onPointerDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY }
        const onPointerUp = (e: PointerEvent) => {
          const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
          if (moved < 5) viewHelperRef.current?.handleClick(e)
        }
        canvas.addEventListener('pointerdown', onPointerDown)
        canvas.addEventListener('pointerup', onPointerUp)

        // ── Render loop ──────────────────────────────────────────────────
        const clock = new THREE.Clock()
        let rafId: number
        const animate = () => {
          rafId = requestAnimationFrame(animate)
          const cam = cameraRef.current
          const ctrls = controlsRef.current
          const vh = viewHelperRef.current
          if (!cam || !ctrls) return
          const delta = clock.getDelta()
          if (vh?.animating) vh.update(delta)  // gizmo drives the camera during a snap
          else ctrls.update()
          renderer.clear()               // autoClear is off (see renderer setup)
          renderer.render(scene, cam)
          vh?.render(renderer)           // draws the gizmo on top, in a corner viewport
        }
        animate()

        // ── Resize observer ──────────────────────────────────────────────
        const ro = new ResizeObserver(() => {
          const cam = cameraRef.current
          const frame = frameRef.current
          if (!container || !renderer || !cam || !frame) return
          const nw = container.clientWidth
          const nh = container.clientHeight
          const aspect = nw / Math.max(1, nh)
          if (cam.type === 'PerspectiveCamera') {
            const pc = cam as THREE.PerspectiveCamera
            pc.aspect = aspect
          } else {
            const oc = cam as THREE.OrthographicCamera
            const H = frame.size * ORTHO_HALF_HEIGHT_FACTOR
            oc.left = -H * aspect; oc.right = H * aspect; oc.top = H; oc.bottom = -H
          }
          cam.updateProjectionMatrix()
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
          canvas.removeEventListener('pointerdown', onPointerDown)
          canvas.removeEventListener('pointerup', onPointerUp)
          viewHelperRef.current?.dispose()
          controls.dispose()
          scene.environment = null
          envTexture.dispose()
          renderer.dispose()
          clayMat.dispose()
          meshGroupRef.current      = null
          rendererRef.current       = null
          sceneRef.current          = null
          cameraRef.current         = null
          controlsRef.current       = null
          viewHelperRef.current     = null
          viewHelperCtorRef.current = null
          threeRef.current          = null
          frameRef.current          = null
          ambientRef.current        = null
          keyLightRef.current       = null
          fillLightRef.current      = null
          viewportReadyRef.current  = false
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

        // FBX/OpenGL UV convention is bottom-up (v=0 at the bottom), while the
        // <img> this texture was decoded from is stored top-down — so the V axis
        // needs to be flipped to line up. This is three.js's default
        // (texture.flipY === true); it must NOT be overridden to false here.
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

  // ── Lighting application effect ───────────────────────────────────────────
  // Depends on viewportState too so the preset re-applies after a scene rebuild.
  useEffect(() => {
    const p = LIGHTING_PRESETS[lightingPreset]
    if (sceneRef.current)    sceneRef.current.environmentIntensity = p.env
    if (ambientRef.current)  ambientRef.current.intensity  = p.ambient
    if (keyLightRef.current) keyLightRef.current.intensity = p.key
    if (fillLightRef.current) fillLightRef.current.intensity = p.fill
  }, [lightingPreset, viewportState])

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
            {!hasMesh && activeNode && onSave && (
              <>
                <button
                  onClick={() => importInputRef.current?.click()}
                  disabled={importing}
                  className="mt-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-300 bg-white/5 hover:bg-[#8b5cf6]/20 hover:text-[#a78bfa] transition-colors outline-none disabled:opacity-50"
                >
                  {importing ? 'Importing…' : 'Import Mesh…'}
                </button>
                <input ref={importInputRef} type="file" accept=".fbx" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportMesh(f); e.target.value = '' }} />
                {importError && (
                  <p className="mt-1 max-w-[240px] text-center text-[10px] text-rose-400/80 leading-relaxed">{importError}</p>
                )}
              </>
            )}
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
            <p className="text-[11px]">Couldn't load this mesh</p>
          </div>
        </div>
      )}

      {viewportState === 'ready' && (
        <>
          {/* ── View + projection cluster (top-left) ── */}
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
            <div className="flex items-center gap-0.5 bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg p-1">
              <ViewButton label="Front" onClick={() => setAxisView('front')} title="Front orthographic view" />
              <ViewButton label="Right" onClick={() => setAxisView('right')} title="Right orthographic view" />
              <ViewButton label="Top"   onClick={() => setAxisView('top')}   title="Top orthographic view" />
            </div>
            <div className="flex items-center gap-0.5 bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg p-1">
              <IconButton icon={Perspective} label="Perspective" active={projection === 'perspective'} onClick={() => changeProjection('perspective')} title="Perspective camera (free orbit)" />
              <IconButton icon={Cube} label="Orthographic" active={projection === 'orthographic'} onClick={() => changeProjection('orthographic')} title="Orthographic camera (pan + zoom only)" />
            </div>
          </div>

          {/* ── Lighting cluster (top-right) ── */}
          <div className="absolute top-3 right-3 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg p-1 z-10">
            {(Object.keys(LIGHTING_PRESETS) as LightingPreset[]).map((k) => (
              <IconButton
                key={k}
                icon={LIGHTING_ICONS[k]}
                label={LIGHTING_PRESETS[k].label}
                active={lightingPreset === k}
                onClick={() => setLightingPreset(k)}
                title={`${LIGHTING_PRESETS[k].label} lighting`}
              />
            ))}
          </div>

          {/* ── Mode toggle toolbar (bottom-center) ── */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg p-1 z-10">
            <IconButton icon={Circle} label="Clay" active={mode === 'clay'} onClick={() => cycleMode('clay')} />
            <IconButton
              icon={ImageIcon}
              label="Textured"
              active={mode === 'textured'}
              disabled={!hasTexture}
              onClick={() => hasTexture && cycleMode('textured')}
              title={hasTexture ? 'Show texture' : 'No texture uploaded for this node'}
            />
            <IconButton icon={CircleDashed} label="Wireframe" active={mode === 'wireframe'} onClick={() => cycleMode('wireframe')} />
          </div>
        </>
      )}
    </div>
  )
}

// ── Toolbar buttons ──────────────────────────────────────────────────────────────

interface ViewButtonProps {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
}

// Text toolbar button — still used for the Front/Right/Top axis-snap cluster.
function ViewButton({ label, active = false, disabled = false, onClick, title }: ViewButtonProps) {
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

interface IconButtonProps {
  icon: PhosphorIcon
  label: string  // accessible name + tooltip fallback; not rendered as visible text
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title?: string  // overrides `label` as the hover tooltip when given (e.g. disabled-state copy)
}

// Icon-only toolbar button, matching the compact icon-cluster style of tools
// like Meshy's viewport toolbar — used for projection, lighting, and shading
// mode, where a glyph reads faster than a text label once you know the set.
function IconButton({ icon: Icon, label, active = false, disabled = false, onClick, title }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      disabled={disabled}
      className={[
        'flex items-center justify-center w-7 h-7 rounded-md transition-colors',
        active
          ? 'bg-white/15 text-white'
          : disabled
            ? 'text-gray-600 cursor-not-allowed'
            : 'text-gray-400 hover:text-gray-200 hover:bg-white/8',
      ].join(' ')}
    >
      <Icon size={14} weight={active ? 'fill' : 'regular'} />
    </button>
  )
}

export default MeshViewport
