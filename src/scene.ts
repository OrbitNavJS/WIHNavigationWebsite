import GUI from "lil-gui";
import {
  AmbientLight,
  AxesHelper,
  DirectionalLightHelper,
  LoadingManager,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  DirectionalLight,
  PlaneGeometry,
  Mesh,
  ShadowMaterial,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Euler,
  GridHelper,
  Box3,
} from "three";
import { WorldInHandControls } from "@world-in-hand-controls/threejs-world-in-hand";
import Stats from "three/examples/jsm/libs/stats.module";
import { toggleFullScreen } from "./helpers/fullscreen";
import "./style.css";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

const CANVAS_ID = "scene";

let canvas: HTMLCanvasElement;
let context: WebGL2RenderingContext;
let renderer: WebGLRenderer;
let scene: Scene;
let loadingManager: LoadingManager;
let ambientLight: AmbientLight;
let directionalLight: DirectionalLight;
let directionalLightHelper: DirectionalLightHelper;
let camera: PerspectiveCamera;
let cameraControls: WorldInHandControls | OrbitControls;
let axesHelper: AxesHelper;
let stats: Stats;
let gui: GUI;

let updateRequested = false;
let resizeRequested = true;

init();

function requestUpdate() {
  if (updateRequested) return;

  updateRequested = true;
  requestAnimationFrame(animate);
}

function init() {
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
    directionalLight.position.set(0, 10, 0);
    scene.add(directionalLight);
  }

  // ===== 📦 OBJECTS =====
  {
     // add gridhelper
    const size = 500;
    const divisions = 100;
    const gridHelper = new GridHelper(size, divisions);
    scene.add(gridHelper);

    // Create an array to store loaded objects
    const loadedObjects: THREE.Object3D[] = [];

    // Function to load a single OBJ file
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

    // Array of OBJ file URLs to load
    const objURLs = [];
    for (let i = 1; i <= 19; i++)
      objURLs.push(`./models/buildings/building${i}.obj`);

    // Load each OBJ file and add it to the scene
    async function loadObjects() {
      try {
        for (const url of objURLs) {
          const object = await loadOBJ(url);
          loadedObjects.push(object);
        }
        // Perform actions once all objects are loaded
        console.log("All objects loaded:", loadedObjects);

        // make a grid with chunks of buildings with streets in between
        const gridSize = 10; // Number of cells in each row/column
        const cellSize = 15; // Size of each cell in Three.js units
        const streetWidth = 2; // Width of streets in Three.js units
        const groundColors = [0x00ff00, 0xb3b3b3, 0x8b4513]; // Green, Grey, Brown
        const streetColor = 0x808080; // Grey
        
        for (let x = 0; x < gridSize; x++) {
            for (let z = 0; z < gridSize; z++) {
        
                // Randomly select ground color
                const groundColor = groundColors[Math.floor(Math.random() * groundColors.length)];
        
                // Create and add ground plane for this square
                const groundGeometry = new PlaneGeometry(cellSize-streetWidth/2, cellSize-streetWidth/2);
                const groundMaterial = new MeshBasicMaterial({ color: groundColor });
                const ground = new Mesh(groundGeometry, groundMaterial);
                ground.position.set((x - gridSize / 2) * cellSize + cellSize / 2, -0.1, (z - gridSize / 2) * cellSize + cellSize / 2);
                ground.rotation.x = -Math.PI / 2;
                scene.add(ground);
        
                // right streets
                {
                    const streetGeometry = new PlaneGeometry(streetWidth, cellSize);
                    const streetMaterial = new MeshBasicMaterial({ color: streetColor });
                    const street = new Mesh(streetGeometry, streetMaterial);
                    street.position.set((x - gridSize / 2) * cellSize, -0.09, (z - gridSize / 2) * cellSize + cellSize / 2);
                    street.rotation.x = -Math.PI / 2;

                    scene.add(street);
                }
        
                // bottom streets
                {
                    const streetGeometry = new PlaneGeometry(cellSize, streetWidth);
                    const streetMaterial = new MeshBasicMaterial({ color: streetColor });
                    const street = new Mesh(streetGeometry, streetMaterial);
                    street.position.set((x - gridSize / 2) * cellSize + cellSize / 2, -0.09, (z - gridSize / 2) * cellSize);
                    street.rotation.x = -Math.PI / 2;

                    scene.add(street);
                }

              // Randomly select 1-4 buildings
              const numBuildings = Math.floor(Math.random() * 4) + 1;
              // generate positions of each corner of the cell
              let cornerPositions = [
                { x: (x - gridSize / 2) * cellSize + cellSize / 4 , z: (z - gridSize / 2) * cellSize + streetWidth*2},//or
                { x: (x - gridSize / 2) * cellSize + cellSize / 4, z: (z - gridSize / 2) * cellSize - streetWidth*2 + cellSize},//ol
                { x: (x - gridSize / 2) * cellSize + cellSize - streetWidth*2 , z: (z - gridSize / 2) * cellSize + streetWidth*2 },//ur
                { x: (x - gridSize / 2) * cellSize + cellSize - streetWidth*2, z: (z - gridSize / 2) * cellSize + cellSize - streetWidth*2 }//ul
              ];

              for (let i = 0; i < numBuildings; i++) {
                // Randomly select a building
                const building = loadedObjects[Math.floor(Math.random() * loadedObjects.length)].clone();

                let cornerPosition;
                if(numBuildings !== 4) {
                  const idx = Math.floor(Math.random() * cornerPositions.length); // Generate a random index
                  cornerPosition = cornerPositions.splice(idx, 1)[0]; 
                } else {
                  cornerPosition = cornerPositions[i];
                }
                building.position.set(cornerPosition.x, building.position.y, cornerPosition.z);

                building.scale.set(0.01, 0.01, 0.01);
                scene.add(building);
              }

            }
        }
      } catch (error) {
        console.error("Error loading objects:", error);
      }
    }

    // Call the function to load objects
    loadObjects();
  }

  // ===== 🎥 CAMERA =====
  {
    camera = new PerspectiveCamera(
      50,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    );
    camera.position.set(25, 5, 4);
    camera.lookAt(new Vector3(0, 0, 0));
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

  cameraControls.update();
}
