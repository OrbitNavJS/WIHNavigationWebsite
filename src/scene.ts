import {
  AmbientLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  DirectionalLight,
  PlaneGeometry,
  Mesh,
  MeshBasicMaterial,
  Group,
  TextureLoader,
  MeshStandardMaterial,
  RepeatWrapping,
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
let camera: PerspectiveCamera;
let cameraControls: WorldInHandControls | OrbitControls;
let stats: Stats;

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
const cellSize = 15;
const streetWidth = 2;

function loadTexture(path: string): THREE.Texture {
  const textureLoader = new TextureLoader();
  const texture = textureLoader.load(path);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(10, 10);
  return texture;
}

const grassColor = loadTexture('./textures/Grass001_1K-PNG_Color.png');
const grassDisplacement = loadTexture('./textures/Grass001_1K-PNG_Displacement.png');
const stoneColor = loadTexture('./textures/concrete.png');
const redColor = loadTexture('./textures/redstone.png');

const asphaltBasic = loadTexture('./textures/asphalt.jpg');
const asphaltColor = asphaltBasic.clone();
const asphaltColor2 = asphaltBasic.clone();
asphaltColor.repeat.set(1, 10);
asphaltColor2.repeat.set(10, 1);

const textureLoader = new TextureLoader();
const shadowTexture = textureLoader.load('./textures/roundshadow.png');


const groundGeometry = new PlaneGeometry(
  cellSize - streetWidth / 2,
  cellSize - streetWidth / 2
);

const stoneMaterial = new MeshStandardMaterial({
map: stoneColor
});
const grassMaterial = new MeshStandardMaterial({
map: grassColor,
displacementMap: grassDisplacement,
displacementScale: 0.1,
});
const redMaterial = new MeshStandardMaterial({
map: redColor
});

function generateChunk(chunkX: number, chunkZ: number) {
  const chunkKey = `${chunkX},${chunkZ}`;

  const chunk = new Group();
  const gridSize = 10;
  chunk.position.set(chunkX, 0, chunkZ);

  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      // pick random groundMaterial from grass, stone, red
      const groundMaterial = Math.random() < 0.5 ? grassMaterial : Math.random() < 0.5 ? stoneMaterial : redMaterial;

      const ground = new Mesh(groundGeometry, groundMaterial);
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
          map: asphaltColor,
        });
        const street = new Mesh(streetGeometry, streetMaterial);
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
          map: asphaltColor2,
        });
        const street = new Mesh(streetGeometry, streetMaterial);

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
        building.scale.set(0.01, 0.01, 0.01);
        building.frustumCulled = true; // should be default
        chunk.add(building);

        // add fake shadow to building
        const shadowMaterial = new MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity:0.3, depthWrite: false});
        const shadowGeometry = new PlaneGeometry(10, 10);
        const shadowPlane = new Mesh(shadowGeometry, shadowMaterial);
        shadowPlane.position.copy(building.position);
        shadowPlane.rotation.x = -Math.PI / 2;
        chunk.add(shadowPlane);
      }
    }
  }

  chunk.name = `chunk-${chunkKey}`;
  scene.add(chunk);
}

// function to generate a grid of chunks
function generateCity(){
  for (let x = -1; x < 2; x++) {
    for (let z = -1; z < 2; z++) {
      generateChunk(x, z);
    }
  }

  // add a long street on left and bottom edge
  {
    const streetGeometry = new PlaneGeometry(streetWidth, chunkSize*3 + streetWidth);
    const colorMap = asphaltBasic.clone();
    colorMap.repeat.set(1, 100);
    const streetMaterial = new MeshBasicMaterial({
      map: colorMap,
    });
    const street = new Mesh(streetGeometry, streetMaterial);
    street.position.set(
        chunkSize*3/2,
        -0.09,
        0
    );
    street.rotation.x = -Math.PI / 2;

    scene.add(street);
  }

  {
    const streetGeometry = new PlaneGeometry(chunkSize*3 + streetWidth, streetWidth);
    const colorMap = asphaltBasic.clone();
    colorMap.repeat.set(100, 1);
    const streetMaterial = new MeshBasicMaterial({
      map: colorMap,
    });;
    const street = new Mesh(streetGeometry, streetMaterial);
    street.position.set(
        0,
        -0.089,
        chunkSize *3/2
    );
    street.rotation.x = -Math.PI / 2;

    scene.add(street);
  }

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

    window.addEventListener("resize", () => {
      resizeRequested = true;
      requestUpdate();
    });

    scene = new Scene();
  }

  // ===== 💡 LIGHTS =====
  {
    ambientLight = new AmbientLight(0xfcf4cc, 1.5);
    scene.add(ambientLight);

    // add directional light
    directionalLight = new DirectionalLight(0xf5f5f5, 1);
    directionalLight.position.set(15, 15, 0);

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
        generateCity();
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


  // ===== 📈 STATS & CLOCK =====
  {
    stats = new Stats();
    document.body.appendChild(stats.dom);
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

await init();