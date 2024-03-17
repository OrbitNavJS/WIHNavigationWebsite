import GUI from "lil-gui";
import {
  AmbientLight,
  AxesHelper,
  DirectionalLightHelper,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  DirectionalLight,
  PlaneGeometry,
  Mesh,
  MeshBasicMaterial,
  GridHelper,
  Group,
  HemisphereLight,
} from "three";
import { WorldInHandControls } from "@world-in-hand-controls/threejs-world-in-hand";
import Stats from "three/examples/jsm/libs/stats.module";
import { toggleFullScreen } from "./helpers/fullscreen";
import "./style.css";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

const CANVAS_ID = "scene";

let canvas: HTMLCanvasElement;
let context: WebGL2RenderingContext;
let renderer: WebGLRenderer;
let scene: Scene;
let ambientLight: AmbientLight;
let directionalLight: DirectionalLight;
let directionalLightHelper: DirectionalLightHelper;
let hemiLight: HemisphereLight;
let camera: PerspectiveCamera;
let cameraControls: WorldInHandControls | OrbitControls;
let axesHelper: AxesHelper;
let stats: Stats;
let gui: GUI;

let updateRequested = false;
let resizeRequested = true;
let objectsLoaded = false;

const loadedObjects: THREE.Object3D[] = [];

function requestUpdate() {
  if (updateRequested) return;

  updateRequested = true;
  requestAnimationFrame(animate);
}

const chunkSize = 150;
const visibleChunks = new Set();
const chunksToRemove = new Set();
const chunkCache = new Map();

function generateChunk(chunkX: number, chunkZ: number) {
  const chunkKey = `${chunkX},${chunkZ}`;

  // check if chunk is cached
  if (chunkCache.has(chunkKey)) {
    const chunk = chunkCache.get(chunkKey);
    visibleChunks.add(chunkKey);
    scene.add(chunk);
    chunkCache.delete(chunkKey);
    return;
  }


  const chunk = new Group();

  const gridSize = 10;
  const cellSize = 15;
  const streetWidth = 2;
  chunk.position.set(chunkX, 0, chunkZ);

  const groundColors = [0x00ff00, 0xb3b3b3, 0x8b4513]; // Green, Grey, Brown
  const streetColor = 0x808080; // Grey

  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      const groundColor =
          groundColors[Math.floor(Math.random() * groundColors.length)];


      const groundGeometry = new PlaneGeometry(
          cellSize - streetWidth / 2,
          cellSize - streetWidth / 2
      );
      const groundMaterial = new MeshBasicMaterial({
        color: groundColor,
      });
      const ground = new Mesh(groundGeometry, groundMaterial);
      //ground.receiveShadow = true;
      ground.position.set(
          (x - gridSize / 2) * cellSize + chunkX * chunkSize + cellSize / 2 - streetWidth / 2 * chunkX,
          -0.1,
          (z - gridSize / 2) * cellSize + chunkZ * chunkSize + cellSize / 2 - streetWidth / 2 * chunkZ
      );
      ground.rotation.x = -Math.PI / 2;
      chunk.add(ground);

      // right streets
      {
        const streetGeometry = new PlaneGeometry(streetWidth, cellSize);
        const streetMaterial = new MeshBasicMaterial({
          color: streetColor,
        });
        const street = new Mesh(streetGeometry, streetMaterial);
        //street.receiveShadow = true;
        street.position.set(
            (x - gridSize / 2) * cellSize + chunkX * chunkSize,
            -0.09,
            (z - gridSize / 2) * cellSize + chunkZ * chunkSize + cellSize / 2
        );
        street.rotation.x = -Math.PI / 2;

        scene.add(street);
      }

      // bottom streets
      {
        const streetGeometry = new PlaneGeometry(cellSize, streetWidth);
        const streetMaterial = new MeshBasicMaterial({
          color: streetColor,
        });
        const street = new Mesh(streetGeometry, streetMaterial);
        //street.receiveShadow = true;

        street.position.set(
            (x - gridSize / 2) * cellSize + chunkX * chunkSize + cellSize / 2 - streetWidth / 2 * chunkX,
            -0.089,
            (z - gridSize / 2) * cellSize + chunkZ * chunkSize - streetWidth / 2 * chunkZ
        );
        street.rotation.x = -Math.PI / 2;

        chunk.add(street);
      }

      const numBuildings = Math.floor(Math.random() * 4) + 1;
      // generate positions of each corner of the cell
      let cornerPositions = [
        {
          x: (x - gridSize / 2) * cellSize + cellSize / 4 - streetWidth / 2 * chunkX,
          z: (z - gridSize / 2) * cellSize + streetWidth * 2 - streetWidth / 2 * chunkZ,
        }, //ur
        {
          x: (x - gridSize / 2) * cellSize + cellSize / 4  - streetWidth / 2 * chunkX,
          z: (z - gridSize / 2) * cellSize + cellSize - streetWidth * 2 - streetWidth / 2 * chunkZ,
        }, //ul
        {
          x: (x - gridSize / 2) * cellSize + cellSize - streetWidth * 2 - streetWidth / 2 * chunkX,
          z: (z - gridSize / 2) * cellSize + streetWidth * 2 - streetWidth / 2 * chunkZ,
        }, //lr
        {
          x: (x - gridSize / 2) * cellSize + cellSize - streetWidth * 2 - streetWidth / 2 * chunkX,
          z: (z - gridSize / 2) * cellSize + cellSize - streetWidth * 2 - streetWidth / 2 * chunkZ,
        }, //ll
      ]

      for (let i = 0; i < numBuildings; i++) {
        const building =
            loadedObjects[
                Math.floor(Math.random() * loadedObjects.length)
                ].clone();

        let cornerPosition;
        if (numBuildings !== 4) {
          const idx = Math.floor(
              Math.random() * cornerPositions.length
          );
          cornerPosition = cornerPositions.splice(idx, 1)[0];
        } else {
          cornerPosition = cornerPositions[i];
        }
        building.position.set(
            chunkX * chunkSize + cornerPosition.x,
            building.position.y,
            chunkZ * chunkSize + cornerPosition.z
        );
        //const rotationY = Math.random() * Math.PI * 2;
        //building.rotation.set(0, rotationY, 0);

        building.scale.set(0.01, 0.01, 0.01);
        building.frustumCulled = true; // should be default
        //building.castShadow = true;
        chunk.add(building);
      }
    }
  }

  console.log(`Adding chunk ${chunkKey}`);

  visibleChunks.add(chunkKey);
  chunk.name = `chunk-${chunkKey}`;
  scene.add(chunk);
}

function removeChunk(chunkX: number, chunkZ: number) {
  const chunkKey = `${chunkX},${chunkZ}`;

  console.log(`Removing chunk ${chunkKey}`);
  const chunk = scene.getObjectByName(`chunk-${chunkKey}`);

  if (chunk) {
    scene.remove(chunk);
    visibleChunks.delete(`${chunkKey}`);

    chunkCache.set(chunkKey, chunk);
    if (chunkCache.size > 10) {
      const oldestChunkKey = chunkCache.keys().next().value;
      chunkCache.delete(oldestChunkKey);
    }
  }
}

function updateVisibleChunks(cameraPosition: Vector3) {
  const cameraChunkX = Math.floor(cameraPosition.x / chunkSize);
  const cameraChunkZ = Math.floor(cameraPosition.z / chunkSize);
  let sceneSizeChanged = false;

  const visibleChunkRadius = 1;
  for (let x = cameraChunkX - visibleChunkRadius; x <= cameraChunkX + visibleChunkRadius; x++) {
    for (let z = cameraChunkZ - visibleChunkRadius; z <= cameraChunkZ + visibleChunkRadius; z++) {
      if (!visibleChunks.has(`${x},${z}`)) {
        generateChunk(x, z);
        sceneSizeChanged = true;
      }
    }
  }

  for (const chunk of visibleChunks) {
    const [x, z] = (chunk as string).split(",").map(Number);
    if (
        x < cameraChunkX - visibleChunkRadius ||
        x > cameraChunkX + visibleChunkRadius ||
        z < cameraChunkZ - visibleChunkRadius ||
        z > cameraChunkZ + visibleChunkRadius
    ) {
      chunksToRemove.add(`${x},${z}`);
    }
  }

  // remove batch of no longer visible chunks
  if (chunksToRemove.size >= 8) {
    for (const chunk of chunksToRemove) {
      const [chunkX, chunkZ] = (chunk as string).split(',').map(Number);
      removeChunk(chunkX, chunkZ);
      visibleChunks.delete(chunk);
      sceneSizeChanged = true;
    }
    chunksToRemove.clear();
  }

  if (sceneSizeChanged) {
    scene.dispatchEvent({type: 'change'});
  }
}

function updateCity(cameraPosition: Vector3) {
  updateVisibleChunks(cameraPosition);
}

async function init() {
  // ===== 🖼️ CANVAS, RENDERER, & SCENE =====
  {
    canvas = document.querySelector(
        `canvas#${CANVAS_ID}`
    )! as HTMLCanvasElement;
    context = canvas.getContext("webgl2") as WebGL2RenderingContext;
    renderer = new WebGLRenderer({
      canvas,
      context,
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: false,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;

    window.addEventListener("resize", () => {
      resizeRequested = true;
      requestUpdate();
    });

    scene = new Scene();
  }

  // ===== 💡 LIGHTS =====
  {
    ambientLight = new AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    // add directional light
    directionalLight = new DirectionalLight(0xf5f5f5, 1);
    directionalLight.position.set(15, 15, 0);
    /*directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024; // Adjust shadow map size as needed
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5; // Adjust shadow camera parameters as needed
    directionalLight.shadow.camera.far = 500;*/

    // sky color ground color intensity 
    /*hemiLight = new HemisphereLight( 0x0000ff, 0x00ff00, 0.6 );
    hemiLight.position.set(15, 15, 0);
    scene.add(hemiLight);*/
    scene.add(directionalLight);
  }

  // ===== 🎥 CAMERA =====
  {
    camera = new PerspectiveCamera(
        50,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        1000
    );
    camera.position.set(25, 25, 4);
    camera.lookAt(new Vector3(0, 0, 0));
  }

  // ===== 📦 OBJECTS =====
  {
    // add gridhelper
    /*const size = 1500;
    const divisions = 500;
    const gridHelper = new GridHelper(size, divisions);
    scene.add(gridHelper);*/

    function loadOBJ(url: string): Promise<THREE.Object3D> {
      return new Promise((resolve, reject) => {
        const loader = new OBJLoader();
        loader.load(
          url,
          (object) => {
            resolve(object);
          },
          undefined,
          reject
        );
      });
    }

    const objURLs: string[] = [];
    for (let i = 1; i <= 19; i++)
      objURLs.push(`./models/buildings/building${i}.obj`);

    async function loadObjects() {
      try {
        for (const url of objURLs) {
          const object = await loadOBJ(url);
          loadedObjects.push(object);
        }
        console.log("All objects loaded");
        objectsLoaded = true;
        updateCity(camera.position);
        requestUpdate();
      } catch (error) {
        console.error("Error loading objects:", error);
      }
    }

    // Call the function to load objects
    await loadObjects();
  }

  // ===== 🕹️ CONTROLS =====
  {
    cameraControls = new WorldInHandControls(
      camera,
      canvas as HTMLCanvasElement,
      renderer,
      scene
    );
    cameraControls.allowRotationBelowGroundPlane = false;
    cameraControls.rotateAroundMousePosition = false;
    cameraControls.useBottomOfBoundingBoxAsGroundPlane = false;
    cameraControls.addEventListener("change", requestUpdate);

    // Full screen
    window.addEventListener("dblclick", (event) => {
      if (event.target === canvas) {
        toggleFullScreen(canvas);
      }
    });
  }

  // ===== 🪄 HELPERS =====
  {
    axesHelper = new AxesHelper(4);
    axesHelper.visible = false;
    scene.add(axesHelper);

    directionalLightHelper = new DirectionalLightHelper(directionalLight, 5);
    directionalLightHelper.visible = false;
    scene.add(directionalLightHelper);
  }

  // ===== 📈 STATS & CLOCK =====
  {
    stats = new Stats();
    document.body.appendChild(stats.dom);
  }

  // ==== 🐞 DEBUG GUI ====
  {
    gui = new GUI({ title: "🐞 Debug GUI", width: 300 });

    const navigationFolder = gui.addFolder("Navigation");
    const navigationModes = ["world-in-hand", "orbit"];
    const navigationMode = { current: null };
    navigationFolder
      .add(navigationMode, "current", navigationModes)
      .name("mode")
      .onChange((value: string) => {
        if (value === "world-in-hand") {
          if (cameraControls !== undefined) {
            cameraControls.dispose();
            cameraControls.removeEventListener("change", requestUpdate);
          }
          cameraControls = new WorldInHandControls(
            camera,
            canvas as HTMLCanvasElement,
            renderer,
            scene
          );
          cameraControls.allowRotationBelowGroundPlane = false;
          cameraControls.addEventListener("change", requestUpdate);
          requestUpdate();
        } else if (value === "orbit") {
          if (cameraControls !== undefined) {
            cameraControls.dispose();
            cameraControls.removeEventListener("change", requestUpdate);
          }
          cameraControls = new OrbitControls(camera, canvas);
          cameraControls.addEventListener("change", requestUpdate);
          requestUpdate();
        }
      });

    const lightsFolder = gui.addFolder("Lights");
    lightsFolder.add(ambientLight, "visible").name("ambient light");
    lightsFolder.add(directionalLight, "visible").name("directional light");

    const helpersFolder = gui.addFolder("Helpers");
    helpersFolder.add(axesHelper, "visible").name("axes");

    // persist GUI state in local storage on changes
    gui.onFinishChange(() => {
      const guiState = gui.save();
      localStorage.setItem("guiState", JSON.stringify(guiState));
      requestUpdate();
    });

    // load GUI state if available in local storage
    const guiState = localStorage.getItem("guiState");
    if (guiState) gui.load(JSON.parse(guiState));

    // reset GUI state button
    const resetGui = () => {
      localStorage.removeItem("guiState");
      gui.reset();
      requestUpdate();
    };
    gui.add({ resetGui }, "resetGui").name("RESET");

    gui.close();
  }
}

function animate() {
  updateRequested = false;

  stats.update();

  if (resizeRequested) {
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    // @ts-expect-error three.js type definitions seem broken, this works.
    scene.dispatchEvent({ type: "resize" });
  }

  if (cameraControls instanceof WorldInHandControls) {
    renderer.setRenderTarget(cameraControls.navigationRenderTarget);
    renderer.render(scene, camera);
  } else {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }

  if (objectsLoaded) updateCity(camera.position);

  cameraControls.update();
}

await init();