import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

(function () {
    'use strict';

    const AU_SCALE = 34;
    const DEFAULT_ASTERANK_QUERY = JSON.stringify({
        a: { $lt: 4.2 },
        e: { $lt: 0.92 },
        i: { $lt: 40 }
    });
    const DEFAULT_MPC_QUERY = '{}';
    const DEFAULT_KEPLER_QUERY = '{}';
    const DEFAULT_SKYMORPH_TARGET = 'J99TS7A';
    const TEXTURE_PATHS = {
        sun: 'img/sunsprite.png',
        sky: 'img/universe.jpg',
        asteroid: 'img/cloud4-circled.png',
        asteroidGlow: 'img/cloud4.png',
        mercury: 'img/texture-mercury.jpg',
        venus: 'img/texture-venus.jpg',
        earth: 'img/texture-earth.jpg',
        mars: 'img/texture-mars.jpg',
        jupiter: 'img/texture-jupiter.jpg'
    };

    const fallbackAsteroids = [
        { id: '99942', name: 'Apophis', semiMajorAxis: 0.9224, eccentricity: 0.1911, inclination: 3.34, ascendingNodeLongitude: 204.45, perihelionArgument: 126.4, orbitalPeriod: 323.6, absoluteMagnitude: 19.7, diameterKm: 0.37, hazardous: true, orbitClass: 'Aten', orbitDescription: 'Earth-crossing asteroid with a semi-major axis below 1 AU.' },
        { id: '101955', name: 'Bennu', semiMajorAxis: 1.1264, eccentricity: 0.2037, inclination: 6.03, ascendingNodeLongitude: 2.06, perihelionArgument: 66.22, orbitalPeriod: 436.6, absoluteMagnitude: 20.5, diameterKm: 0.49, hazardous: true, orbitClass: 'Apollo', orbitDescription: 'Well-studied near-Earth asteroid and OSIRIS-REx target.' },
        { id: '433', name: 'Eros', semiMajorAxis: 1.458, eccentricity: 0.223, inclination: 10.83, ascendingNodeLongitude: 304.27, perihelionArgument: 178.83, orbitalPeriod: 643.2, absoluteMagnitude: 10.4, diameterKm: 16.84, hazardous: false, orbitClass: 'Amor', orbitDescription: 'Large near-Earth asteroid visited by NEAR Shoemaker.' },
        { id: '3200', name: 'Phaethon', semiMajorAxis: 1.271, eccentricity: 0.889, inclination: 22.17, ascendingNodeLongitude: 265.27, perihelionArgument: 322.13, orbitalPeriod: 523.5, absoluteMagnitude: 14.6, diameterKm: 5.1, hazardous: true, orbitClass: 'Apollo', orbitDescription: 'Asteroid linked to the Geminid meteor stream.' },
        { id: '65803', name: 'Didymos', semiMajorAxis: 1.644, eccentricity: 0.384, inclination: 3.41, ascendingNodeLongitude: 73.18, perihelionArgument: 319.32, orbitalPeriod: 770.1, absoluteMagnitude: 18.2, diameterKm: 0.78, hazardous: false, orbitClass: 'Apollo', orbitDescription: 'Binary asteroid targeted by the DART mission.' },
        { id: '1', name: 'Ceres', semiMajorAxis: 2.768, eccentricity: 0.076, inclination: 10.59, ascendingNodeLongitude: 80.25, perihelionArgument: 73.37, orbitalPeriod: 1680, absoluteMagnitude: 3.34, diameterKm: 939.4, hazardous: false, orbitClass: 'Dwarf Planet', orbitDescription: 'Largest body in the main belt.' },
        { id: '4', name: 'Vesta', semiMajorAxis: 2.361, eccentricity: 0.089, inclination: 7.14, ascendingNodeLongitude: 103.81, perihelionArgument: 151.2, orbitalPeriod: 1325.9, absoluteMagnitude: 3.2, diameterKm: 525.4, hazardous: false, orbitClass: 'Main Belt', orbitDescription: 'Bright differentiated asteroid in the main belt.' },
        { id: '16', name: 'Psyche', semiMajorAxis: 2.924, eccentricity: 0.14, inclination: 3.1, ascendingNodeLongitude: 150.19, perihelionArgument: 228.05, orbitalPeriod: 1824, absoluteMagnitude: 5.93, diameterKm: 226, hazardous: false, orbitClass: 'Main Belt', orbitDescription: 'Metal-rich target of NASA\'s Psyche mission.' }
    ];

    const fallbackFeeds = {
        asterank: [
            { full_name: '99942 Apophis', class: 'Aten', diameter: 0.37, a: 0.9224, e: 0.1911 },
            { full_name: '101955 Bennu', class: 'Apollo', diameter: 0.49, a: 1.1264, e: 0.2037 },
            { full_name: '3200 Phaethon', class: 'Apollo', diameter: 5.1, a: 1.271, e: 0.889 }
        ],
        mpc: [
            { readable_des: 'Apophis', epoch: '2460400.5', num_obs: '1500+', a: 0.9224, i: 3.34 },
            { readable_des: 'Bennu', epoch: '2460400.5', num_obs: '1200+', a: 1.1264, i: 6.03 },
            { readable_des: 'Didymos', epoch: '2460400.5', num_obs: '900+', a: 1.644, i: 3.41 }
        ],
        kepler: [
            { KOI: '157.01', PER: 9.48, RPLANET: 1.9, TSTAR: 5804, KMAG: 11.7 },
            { KOI: '701.03', PER: 122.39, RPLANET: 2.7, TSTAR: 5541, KMAG: 13.2 },
            { KOI: '72.01', PER: 45.29, RPLANET: 2.3, TSTAR: 5450, KMAG: 12.4 }
        ],
        skymorph: [
            { obs_id: 'J99TS7A-1', time: 'Recent sample', mag: '19.2', predicted_ra: '10:12:44', predicted_dec: '+12:18:01' },
            { obs_id: 'J99TS7A-2', time: 'Recent sample', mag: '19.4', predicted_ra: '10:12:46', predicted_dec: '+12:17:58' },
            { obs_id: 'J99TS7A-3', time: 'Recent sample', mag: '19.1', predicted_ra: '10:12:48', predicted_dec: '+12:17:55' }
        ]
    };

    const referencePlanets = [
        { key: 'mercury', name: 'Mercury', orbitRadius: 0.387, size: 0.42, orbitColor: 0xa78bfa, speed: 0.92 },
        { key: 'venus', name: 'Venus', orbitRadius: 0.723, size: 0.7, orbitColor: 0xf59e0b, speed: 0.64 },
        { key: 'earth', name: 'Earth', orbitRadius: 1, size: 0.76, orbitColor: 0x7dd3fc, speed: 0.48 },
        { key: 'mars', name: 'Mars', orbitRadius: 1.524, size: 0.58, orbitColor: 0xfb923c, speed: 0.32 },
        { key: 'jupiter', name: 'Jupiter', orbitRadius: 5.203, size: 1.6, orbitColor: 0xfacc15, speed: 0.12 }
    ];

    const state = {
        asteroids: [],
        asteroidMeshes: [],
        asteroidSprites: [],
        asteroidOrbits: [],
        asteroidLabels: [],
        planetMeshes: [],
        planetRings: [],
        selectedId: null,
        showOrbits: true,
        showLabels: true,
        hazardOnly: false,
        followSelected: true,
        playing: true,
        speedMultiplier: 1.25,
        dataSource: 'Initializing',
        apiFeeds: { asterank: [], mpc: [], kepler: [], skymorph: [] },
        textures: {},
        lastFrameTime: performance.now(),
        leftPointer: null,
        selectedWorldPosition: null,
        suppressFollowRelease: false,
        focusedMode: false,
        focusedName: ''
    };

    let scene;
    let camera;
    let renderer;
    let controls;
    let raycaster;
    let mouse;
    let textureLoader;
    let sunMesh;
    let sunGlow;
    let stars;

    const elements = {};

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheElements();
        bindUi();
        if (!initScene()) {
            setDataSource('Three.js failed to load');
            hydrateFallbackFeeds();
            renderFallbackMessage('Three.js did not load. The viewer cannot render, but the feed panels can still populate when the API relay is available.');
            fetchAllFeeds();
            return;
        }

        loadTextures()
            .catch(function (error) {
                console.error('Texture load warning:', error);
            })
            .finally(function () {
                hydrateFallbackData();
                animate(performance.now());
                fetchSimulationData();
                fetchAllFeeds();
            });
    }

    function cacheElements() {
        [
            'asteroidViewport', 'viewerFrame', 'dataSourceBadge', 'selectionLabel', 'objectCountBadge', 'listCountBadge',
            'statLoaded', 'statHazardous', 'statFastest', 'playPauseBtn', 'toggleOrbitsBtn', 'followBtn',
            'resetCameraBtn', 'fullscreenBtn', 'speedSlider', 'speedValue', 'hazardOnlyToggle', 'asteroidList', 'selectedObjectPanel',
            'targetSearchInput', 'targetSearchBtn', 'targetSearchStatus', 'refreshFeedsBtn', 'asterankFeed', 'mpcFeed', 'keplerFeed',
            'skymorphFeed', 'asterankFeedCount', 'mpcFeedCount', 'keplerFeedCount', 'skymorphFeedCount',
            'focusedBanner', 'focusedLabel', 'exitFocusedBtn'
        ].forEach(function (id) {
            elements[id] = document.getElementById(id);
        });
    }

    function bindUi() {
        elements.playPauseBtn.addEventListener('click', function () {
            state.playing = !state.playing;
            elements.playPauseBtn.textContent = state.playing ? 'Pause' : 'Play';
        });

        elements.toggleOrbitsBtn.addEventListener('click', function () {
            state.showOrbits = !state.showOrbits;
            elements.toggleOrbitsBtn.textContent = state.showOrbits ? 'Hide Orbits' : 'Show Orbits';
            applyVisibility();
        });

        document.querySelectorAll('.tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const tab = btn.getAttribute('data-tab');
                document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('tab-active'); });
                document.querySelectorAll('.tab-pane').forEach(function (p) { p.classList.remove('tab-pane-active'); });
                btn.classList.add('tab-active');
                const pane = document.getElementById(tab + 'Feed');
                if (pane) { pane.classList.add('tab-pane-active'); }
            });
        });

        elements.followBtn.addEventListener('click', function () {
            state.followSelected = !state.followSelected;
            elements.followBtn.textContent = state.followSelected ? 'Follow On' : 'Follow Off';
            if (!state.followSelected) {
                state.selectedWorldPosition = null;
            }
        });

        elements.resetCameraBtn.addEventListener('click', resetCamera);

        elements.fullscreenBtn.addEventListener('click', function () {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
                return;
            }
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen();
            }
        });

        elements.speedSlider.addEventListener('input', function () {
            state.speedMultiplier = parseFloat(elements.speedSlider.value);
            elements.speedValue.textContent = formatNumber(state.speedMultiplier, 2) + 'x';
        });

        elements.hazardOnlyToggle.addEventListener('change', function () {
            state.hazardOnly = elements.hazardOnlyToggle.checked;
            applyVisibility();
        });

        elements.targetSearchBtn.addEventListener('click', function () {
            searchSkyMorph(elements.targetSearchInput.value.trim());
        });

        elements.targetSearchInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                searchSkyMorph(elements.targetSearchInput.value.trim());
            }
        });

        elements.refreshFeedsBtn.addEventListener('click', fetchAllFeeds);

        if (elements.exitFocusedBtn) {
            elements.exitFocusedBtn.addEventListener('click', exitFocusedMode);
        }

        document.getElementById('hideSidebarBtn').addEventListener('click', function () {
            document.getElementById('sidebar').style.display = 'none';
            document.body.classList.add('sidebar-hidden');
            document.getElementById('showSidebarBtn').style.display = 'block';
            onResize();
        });
        document.getElementById('showSidebarBtn').addEventListener('click', function () {
            document.getElementById('sidebar').style.display = '';
            document.body.classList.remove('sidebar-hidden');
            document.getElementById('showSidebarBtn').style.display = 'none';
            onResize();
        });

        window.addEventListener('resize', onResize);
        document.addEventListener('fullscreenchange', function () {
            setTimeout(onResize, 150);
        });
    }

    function initScene() {
        if (typeof THREE === 'undefined' || typeof OrbitControls !== 'function') {
            return false;
        }

        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x050b14, 0.0017);

        const width = elements.viewerFrame.clientWidth || window.innerWidth;
        const height = elements.viewerFrame.clientHeight || window.innerHeight;
        camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 5000);
        camera.position.set(0, 58, 130);

        renderer = new THREE.WebGLRenderer({ canvas: elements.asteroidViewport, antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.screenSpacePanning = true;
        controls.minDistance = 15;
        controls.maxDistance = 360;
        controls.zoomSpeed = 1.05;
        controls.panSpeed = 0.9;
        controls.rotateSpeed = 0.72;
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE
        };
        controls.target.set(0, 0, 0);
        controls.addEventListener('start', onControlsStart);

        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        textureLoader = new THREE.TextureLoader();

        renderer.domElement.addEventListener('pointerdown', onCanvasPointerDown, true);
        renderer.domElement.addEventListener('pointerup', onCanvasPointerUp, true);
        renderer.domElement.addEventListener('pointermove', onCanvasPointerMove, true);
        renderer.domElement.addEventListener('wheel', function (event) {
            event.preventDefault();
        }, { passive: false });
        renderer.domElement.addEventListener('contextmenu', function (event) {
            event.preventDefault();
        });

        addLights();
        createSun();
        createStarfield();
        createReferenceSystem();
        resetCamera();
        return true;
    }

    function addLights() {
        scene.add(new THREE.AmbientLight(0xffffff, 0.34));

        const sunLight = new THREE.PointLight(0xffe4a6, 2.5, 800, 1.2);
        sunLight.position.set(0, 0, 0);
        scene.add(sunLight);

        const rim = new THREE.DirectionalLight(0x8dd8ff, 0.48);
        rim.position.set(120, 60, 10);
        scene.add(rim);
    }

    function createSun() {
        sunMesh = new THREE.Mesh(
            new THREE.SphereGeometry(3.5, 40, 40),
            new THREE.MeshBasicMaterial({ color: 0xffc857 })
        );
        sunGlow = new THREE.Mesh(
            new THREE.SphereGeometry(5.2, 40, 40),
            new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.26 })
        );
        scene.add(sunMesh);
        scene.add(sunGlow);
    }

    function createStarfield() {
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        for (let index = 0; index < 7000; index += 1) {
            const radius = 400 + Math.random() * 1600;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions.push(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.cos(phi),
                radius * Math.sin(phi) * Math.sin(theta)
            );
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        stars = new THREE.Points(
            geometry,
            new THREE.PointsMaterial({ color: 0xf8fbff, size: 1.1, transparent: true, opacity: 0.92 })
        );
        scene.add(stars);
    }

    function createReferenceSystem() {
        referencePlanets.forEach(function (planet, index) {
            const ring = createReferenceRing(planet.orbitRadius, planet.orbitColor);
            scene.add(ring);
            state.planetRings.push(ring);

            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(planet.size, 32, 32),
                new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0.02 })
            );
            mesh.userData = {
                key: planet.key,
                name: planet.name,
                orbitRadius: planet.orbitRadius,
                phase: (index / referencePlanets.length) * Math.PI * 2,
                speed: planet.speed
            };
            scene.add(mesh);
            state.planetMeshes.push(mesh);
        });
    }

    function createReferenceRing(radiusAu, color) {
        const points = [];
        const scaledRadius = radiusAu * AU_SCALE;
        for (let index = 0; index <= 256; index += 1) {
            const angle = (index / 256) * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(angle) * scaledRadius, 0, Math.sin(angle) * scaledRadius));
        }

        return new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.24 })
        );
    }

    function loadTextures() {
        const entries = Object.entries(TEXTURE_PATHS);
        return Promise.allSettled(entries.map(function (entry) {
            return loadTexture(entry[1]);
        })).then(function (results) {
            results.forEach(function (result, index) {
                if (result.status === 'fulfilled') {
                    const key = entries[index][0];
                    result.value.colorSpace = THREE.SRGBColorSpace;
                    state.textures[key] = result.value;
                }
            });
            applyTextures();
        });
    }

    function loadTexture(path) {
        return new Promise(function (resolve, reject) {
            textureLoader.load(path, resolve, undefined, reject);
        });
    }

    function applyTextures() {
        if (state.textures.sun && sunMesh) {
            sunMesh.material.map = state.textures.sun;
            sunMesh.material.color.set(0xffffff);
            sunMesh.material.needsUpdate = true;
        }

        if (state.textures.sky) {
            const sky = new THREE.Mesh(
                new THREE.SphereGeometry(2200, 48, 48),
                new THREE.MeshBasicMaterial({ map: state.textures.sky, side: THREE.BackSide, transparent: true, opacity: 0.88 })
            );
            scene.add(sky);
        }

        state.planetMeshes.forEach(function (mesh) {
            const texture = state.textures[mesh.userData.key];
            if (texture) {
                mesh.material.map = texture;
                mesh.material.color.set(0xffffff);
                mesh.material.needsUpdate = true;
            }
        });

        refreshAsteroidMaterials();
    }

    function resetCamera() {
        if (!camera || !controls) {
            return;
        }
        camera.position.set(0, 58, 130);
        controls.target.set(0, 0, 0);
        controls.update();
        state.selectedWorldPosition = null;
    }

    function onResize() {
        if (!renderer || !camera) {
            return;
        }
        const width = elements.viewerFrame.clientWidth || window.innerWidth;
        const height = elements.viewerFrame.clientHeight || window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    function onCanvasPointerDown(event) {
        if (event.button === 0) {
            state.leftPointer = { x: event.clientX, y: event.clientY, moved: false };
            controls.enabled = false;
        }
    }

    function onCanvasPointerMove(event) {
        if (!state.leftPointer) {
            return;
        }
        const dx = Math.abs(event.clientX - state.leftPointer.x);
        const dy = Math.abs(event.clientY - state.leftPointer.y);
        if (dx > 5 || dy > 5) {
            state.leftPointer.moved = true;
        }
    }

    function onCanvasPointerUp(event) {
        const wasLeft = event.button === 0 && state.leftPointer;
        controls.enabled = true;
        if (!wasLeft) {
            return;
        }

        const pointer = state.leftPointer;
        state.leftPointer = null;
        if (!pointer.moved) {
            selectFromPointer(event);
        }
    }

    function onControlsStart() {
        if (state.suppressFollowRelease) {
            return;
        }

        if (state.followSelected) {
            state.followSelected = false;
            state.selectedWorldPosition = null;
            elements.followBtn.textContent = 'Follow Off';
        }
    }

    function selectFromPointer(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(
            state.asteroidMeshes.concat(state.asteroidSprites).concat(state.planetMeshes),
            false
        );
        if (hits.length) {
            const obj = hits[0].object;
            if (obj.userData.asteroidId) {
                selectAsteroid(obj.userData.asteroidId, true);
            } else if (obj.userData.key) {
                selectPlanet(obj);
            }
        }
    }

    function animate(now) {
        requestAnimationFrame(animate);
        if (!renderer || !camera) {
            return;
        }

        const deltaSeconds = Math.min(0.05, (now - state.lastFrameTime) / 1000);
        state.lastFrameTime = now;

        if (state.playing) {
            updatePlanets(deltaSeconds);
            updateAsteroids(deltaSeconds, now);
        }

        sunMesh.rotation.y += deltaSeconds * 0.14;
        sunGlow.scale.setScalar(1 + Math.sin(now * 0.0018) * 0.06);
        stars.rotation.y += deltaSeconds * 0.004;
        stars.rotation.x += deltaSeconds * 0.0012;

        followSelectedObject();
        controls.update();
        renderer.render(scene, camera);
    }

    function updatePlanets(deltaSeconds) {
        state.planetMeshes.forEach(function (mesh) {
            mesh.userData.phase += deltaSeconds * mesh.userData.speed * state.speedMultiplier * 0.25;
            const orbitRadius = mesh.userData.orbitRadius * AU_SCALE;
            mesh.position.set(
                Math.cos(mesh.userData.phase) * orbitRadius,
                0,
                Math.sin(mesh.userData.phase) * orbitRadius
            );
            mesh.rotation.y += deltaSeconds * 0.4;
        });
    }

    function updateAsteroids(deltaSeconds, now) {
        state.asteroids.forEach(function (asteroid, index) {
            asteroid.phase += deltaSeconds * state.speedMultiplier * asteroid.speed;
            const position = computeOrbitPosition(asteroid, asteroid.phase);
            const mesh = state.asteroidMeshes[index];
            const sprite = state.asteroidSprites[index];
            const label = state.asteroidLabels[index];

            if (mesh) {
                mesh.position.copy(position);
                mesh.rotation.y += deltaSeconds * 0.5;
                mesh.rotation.x += deltaSeconds * 0.08;
            }

            if (sprite) {
                sprite.position.copy(position);
                const isSelected = asteroid.id === state.selectedId;
                const pulse = asteroid.hazardous ? 1.08 + Math.sin(now * 0.004 + index) * 0.15 : 1 + Math.sin(now * 0.003 + index) * 0.07;
                const baseScale = sprite.userData.baseScale || 4;
                const selectionBoost = isSelected ? 1.45 : 1;
                sprite.scale.setScalar(baseScale * pulse * selectionBoost);
                sprite.material.opacity = isSelected ? 1 : (asteroid.hazardous ? 0.92 : 0.84);
                sprite.material.color.set(isSelected ? 0xffffff : (asteroid.hazardous ? 0xff889b : 0x8fd6ff));
            }

            if (label) {
                label.position.copy(position.clone().add(new THREE.Vector3(0, 2.6, 0)));
            }
        });
    }

    function followSelectedObject() {
        if (!state.followSelected || !state.selectedId) {
            return;
        }

        const selectedMesh = state.asteroidMeshes.find(function (mesh) {
            return mesh.userData.asteroidId === state.selectedId;
        });

        if (!selectedMesh) {
            return;
        }

        const currentPosition = selectedMesh.position.clone();
        if (state.selectedWorldPosition) {
            const delta = currentPosition.clone().sub(state.selectedWorldPosition);
            controls.target.add(delta);
            camera.position.add(delta);
        }
        state.selectedWorldPosition = currentPosition;
    }

    function computeOrbitPosition(asteroid, anomaly) {
        const semiMajorAxis = asteroid.semiMajorAxis * AU_SCALE;
        const eccentricity = asteroid.eccentricity;
        const inclination = THREE.MathUtils.degToRad(asteroid.inclination);
        const ascendingNode = THREE.MathUtils.degToRad(asteroid.ascendingNodeLongitude);
        const perihelionArgument = THREE.MathUtils.degToRad(asteroid.perihelionArgument);
        const radius = (semiMajorAxis * (1 - eccentricity * eccentricity)) / (1 + eccentricity * Math.cos(anomaly));
        const cosOmega = Math.cos(ascendingNode);
        const sinOmega = Math.sin(ascendingNode);
        const cosI = Math.cos(inclination);
        const sinI = Math.sin(inclination);
        const cosWv = Math.cos(perihelionArgument + anomaly);
        const sinWv = Math.sin(perihelionArgument + anomaly);

        return new THREE.Vector3(
            radius * (cosOmega * cosWv - sinOmega * sinWv * cosI),
            radius * (sinWv * sinI),
            radius * (sinOmega * cosWv + cosOmega * sinWv * cosI)
        );
    }

    function createOrbitLine(asteroid) {
        const points = [];
        for (let index = 0; index <= 280; index += 1) {
            const angle = (index / 280) * Math.PI * 2;
            points.push(computeOrbitPosition(asteroid, angle));
        }
        return new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({
                color: asteroid.hazardous ? 0xff889b : 0x7dd3fc,
                transparent: true,
                opacity: asteroid.hazardous ? 0.55 : 0.18
            })
        );
    }

    function buildAsteroids(asteroids) {
        clearAsteroids();

        state.asteroids = asteroids.map(function (asteroid, index) {
            return Object.assign({}, asteroid, {
                phase: (index / Math.max(asteroids.length, 1)) * Math.PI * 2,
                speed: Math.max(0.08, 14 / asteroid.orbitalPeriod)
            });
        });

        state.asteroids.forEach(function (asteroid) {
            const orbit = createOrbitLine(asteroid);
            orbit.userData.asteroidId = asteroid.id;
            orbit.userData.baseOpacity = asteroid.hazardous ? 0.55 : 0.18;
            scene.add(orbit);
            state.asteroidOrbits.push(orbit);

            const radius = THREE.MathUtils.clamp(0.65 + Math.log10(Math.max(asteroid.diameterKm || 0.1, 0.1)) * 0.5, 0.62, 2.6);
            const mesh = new THREE.Mesh(
                new THREE.SphereGeometry(radius, 28, 28),
                createAsteroidMaterial(asteroid)
            );
            mesh.userData.asteroidId = asteroid.id;
            mesh.visible = false;
            scene.add(mesh);
            state.asteroidMeshes.push(mesh);

            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: state.textures.asteroidGlow || null,
                color: asteroid.hazardous ? 0xff889b : 0x8fd6ff,
                transparent: true,
                opacity: asteroid.hazardous ? 0.92 : 0.84,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            }));
            sprite.userData.asteroidId = asteroid.id;
            sprite.userData.baseScale = THREE.MathUtils.clamp(radius * (asteroid.hazardous ? 5.8 : 4.2), 3.2, 10);
            sprite.userData.sharedMap = true;
            sprite.scale.setScalar(sprite.userData.baseScale);
            scene.add(sprite);
            state.asteroidSprites.push(sprite);

            const label = makeLabelSprite(asteroid.name);
            label.visible = false;
            scene.add(label);
            state.asteroidLabels.push(label);
        });

        applyVisibility();
        updateStats();
        if (state.asteroids.length) {
            selectAsteroid(state.asteroids[0].id, false);
        }
    }

    function clearAsteroids() {
        state.asteroidMeshes.forEach(disposeMesh);
        state.asteroidSprites.forEach(disposeSprite);
        state.asteroidOrbits.forEach(disposeLine);
        state.asteroidLabels.forEach(disposeSprite);
        state.asteroidMeshes = [];
        state.asteroidSprites = [];
        state.asteroidOrbits = [];
        state.asteroidLabels = [];
    }

    function disposeMesh(mesh) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    }

    function disposeSprite(sprite) {
        scene.remove(sprite);
        if (!sprite.userData.sharedMap && sprite.material.map && sprite.material.map.dispose) {
            sprite.material.map.dispose();
        }
        sprite.material.dispose();
    }

    function disposeLine(line) {
        scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
    }

    function createAsteroidMaterial(asteroid) {
        return new THREE.MeshStandardMaterial({
            map: state.textures.mercury || null,
            color: asteroid.hazardous ? 0xffe2e6 : 0xffffff,
            emissive: asteroid.hazardous ? 0x5b0917 : 0x0d1828,
            emissiveIntensity: asteroid.hazardous ? 0.36 : 0.14,
            roughness: 0.92,
            metalness: 0.03
        });
    }

    function refreshAsteroidMaterials() {
        state.asteroidMeshes.forEach(function (mesh, index) {
            const oldMaterial = mesh.material;
            mesh.material = createAsteroidMaterial(state.asteroids[index]);
            oldMaterial.dispose();
        });

        state.asteroidSprites.forEach(function (sprite) {
            if (state.textures.asteroidGlow) {
                sprite.material.map = state.textures.asteroidGlow;
                sprite.material.needsUpdate = true;
            }
        });
    }

    function makeLabelSprite(text) {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 88;
        const context = canvas.getContext('2d');
        context.fillStyle = 'rgba(5, 12, 22, 0.82)';
        context.fillRect(0, 8, canvas.width, 60);
        context.strokeStyle = 'rgba(125, 211, 252, 0.45)';
        context.strokeRect(0, 8, canvas.width, 60);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = '700 32px Rajdhani';
        context.fillStyle = '#edf4ff';
        context.fillText(text, canvas.width / 2, 40);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(16, 4.4, 1);
        return sprite;
    }

    function selectAsteroid(id, easeCamera) {
        const asteroid = state.asteroids.find(function (entry) {
            return entry.id === id;
        });
        if (!asteroid) {
            return;
        }

        state.selectedId = id;
        state.followSelected = true;
        elements.followBtn.textContent = 'Follow On';
        applyVisibility();
        updateSelectedPanel(asteroid);
        elements.selectionLabel.textContent = asteroid.name + ' selected';

        const mesh = state.asteroidMeshes.find(function (entry) {
            return entry.userData.asteroidId === id;
        });
        if (mesh) {
            state.selectedWorldPosition = mesh.position.clone();
            if (easeCamera) {
                state.suppressFollowRelease = true;
                controls.target.copy(mesh.position);
                camera.position.copy(mesh.position.clone().add(new THREE.Vector3(18, 10, 18)));
                controls.update();
                state.suppressFollowRelease = false;
            }
        }
    }

    function selectPlanet(mesh) {
        const name = mesh.userData.name || mesh.userData.key;
        const orbitRadius = mesh.userData.orbitRadius;
        const periodDays = formatNumber(365.25 * Math.pow(orbitRadius, 1.5), 1);

        state.selectedId = null;
        state.followSelected = false;
        elements.followBtn.textContent = 'Follow Off';
        elements.selectionLabel.textContent = name + ' selected';

        state.suppressFollowRelease = true;
        controls.target.copy(mesh.position);
        camera.position.copy(mesh.position.clone().add(new THREE.Vector3(18, 10, 18)));
        controls.update();
        state.suppressFollowRelease = false;

        elements.selectedObjectPanel.innerHTML = [
            '<div class="selected-card">',
            '<div class="selected-head">',
            '<div>',
            '<div class="selected-title">' + escapeHtml(name) + '</div>',
            '<div class="eyebrow">Reference planet</div>',
            '</div>',
            '<span class="tag tag-safe">Planet</span>',
            '</div>',
            '<div class="selected-grid">',
            metricCell('Orbit radius', formatNumber(orbitRadius, 3) + ' AU'),
            metricCell('Orbital period', periodDays + ' d'),
            '</div>',
            '</div>'
        ].join('');
    }

    function updateSelectedPanel(asteroid) {
        elements.selectedObjectPanel.innerHTML = [
            '<div class="selected-card">',
            '<div class="selected-head">',
            '<div>',
            '<div class="selected-title">' + escapeHtml(asteroid.name) + '</div>',
            '<div class="eyebrow">' + escapeHtml(asteroid.orbitClass) + '</div>',
            '</div>',
            '<span class="tag ' + (asteroid.hazardous ? 'tag-danger' : 'tag-safe') + '">' + (asteroid.hazardous ? 'Potentially hazardous' : 'Tracked object') + '</span>',
            '</div>',
            '<div class="selected-grid">',
            metricCell('Semi-major axis', formatNumber(asteroid.semiMajorAxis, 3) + ' AU'),
            metricCell('Eccentricity', formatNumber(asteroid.eccentricity, 3)),
            metricCell('Inclination', formatNumber(asteroid.inclination, 2) + ' deg'),
            metricCell('Orbital period', formatNumber(asteroid.orbitalPeriod, 1) + ' d'),
            metricCell('Diameter', formatNumber(asteroid.diameterKm, 2) + ' km'),
            metricCell('Absolute magnitude', formatNumber(asteroid.absoluteMagnitude, 2)),
            '</div>',
            '<p class="selected-description">' + escapeHtml(asteroid.orbitDescription || 'No description available.') + '</p>',
            '</div>'
        ].join('');
    }

    function metricCell(label, value) {
        return '<div><span class="selected-meta-label">' + escapeHtml(label) + '</span><span class="selected-meta-value">' + escapeHtml(value) + '</span></div>';
    }

    function applyVisibility() {
        const visibleObjects = getVisibleAsteroids();
        const visibleIds = new Set(visibleObjects.map(function (entry) {
            return entry.id;
        }));

        state.asteroidMeshes.forEach(function (mesh) {
            const selected = mesh.userData.asteroidId === state.selectedId;
            mesh.visible = visibleIds.has(mesh.userData.asteroidId) && selected;
        });

        state.asteroidSprites.forEach(function (sprite) {
            const selected = sprite.userData.asteroidId === state.selectedId;
            sprite.visible = visibleIds.has(sprite.userData.asteroidId);
            sprite.renderOrder = selected ? 4 : 2;
        });

        state.asteroidOrbits.forEach(function (orbit) {
            const selected = orbit.userData.asteroidId === state.selectedId;
            orbit.visible = visibleIds.has(orbit.userData.asteroidId) && state.showOrbits;
            orbit.material.opacity = selected ? 0.95 : orbit.userData.baseOpacity;
            orbit.material.color.set(selected ? 0xf8fbff : (orbit.userData.baseOpacity > 0.2 ? 0xff889b : 0x7dd3fc));
        });

        state.asteroidLabels.forEach(function (label, index) {
            label.visible = state.showLabels && visibleIds.has(state.asteroids[index].id) && state.asteroids[index].id === state.selectedId;
        });

        renderObjectList();
        updateStats();

        if (state.selectedId && !visibleIds.has(state.selectedId)) {
            if (visibleObjects.length) {
                selectAsteroid(visibleObjects[0].id, false);
            } else {
                state.selectedId = null;
                elements.selectionLabel.textContent = 'No asteroid selected';
                renderFallbackMessage('No asteroids match the current filter.');
            }
        }
    }

    function getVisibleAsteroids() {
        return state.asteroids.filter(function (asteroid) {
            return !state.hazardOnly || asteroid.hazardous;
        });
    }

    function renderObjectList() {
        const visible = getVisibleAsteroids();
        elements.objectCountBadge.textContent = visible.length + ' objects';
        elements.listCountBadge.textContent = visible.length + ' visible';

        if (!visible.length) {
            elements.asteroidList.innerHTML = '<div class="empty-state">No asteroids match the current filter.</div>';
            return;
        }

        elements.asteroidList.innerHTML = visible.map(function (asteroid) {
            const active = asteroid.id === state.selectedId ? ' active' : '';
            const tagClass = asteroid.hazardous ? 'tag-danger' : 'tag-safe';
            const tagLabel = asteroid.hazardous ? 'Hazardous' : asteroid.orbitClass;
            return [
                '<button class="object-card' + active + '" type="button" data-asteroid-id="' + escapeHtml(asteroid.id) + '">',
                '<div class="object-head">',
                '<div>',
                '<div class="object-name">' + escapeHtml(asteroid.name) + '</div>',
                '<div class="eyebrow">' + escapeHtml(asteroid.orbitClass) + '</div>',
                '</div>',
                '<span class="tag ' + tagClass + '">' + escapeHtml(tagLabel) + '</span>',
                '</div>',
                '<div class="object-meta">',
                metricCell('a', formatNumber(asteroid.semiMajorAxis, 3) + ' AU'),
                metricCell('Period', formatNumber(asteroid.orbitalPeriod, 1) + ' d'),
                '</div>',
                '</button>'
            ].join('');
        }).join('');

        elements.asteroidList.querySelectorAll('[data-asteroid-id]').forEach(function (button) {
            button.addEventListener('click', function () {
                selectAsteroid(button.getAttribute('data-asteroid-id'), true);
            });
        });
    }

    function updateStats() {
        const visible = getVisibleAsteroids();
        elements.statLoaded.textContent = String(visible.length).padStart(2, '0');
        elements.statHazardous.textContent = String(visible.filter(function (asteroid) {
            return asteroid.hazardous;
        }).length).padStart(2, '0');

        if (!visible.length) {
            elements.statFastest.textContent = 'None';
            return;
        }

        const fastest = visible.slice().sort(function (left, right) {
            return left.orbitalPeriod - right.orbitalPeriod;
        })[0];
        elements.statFastest.textContent = fastest.name;
    }

    function renderFallbackMessage(message) {
        elements.selectedObjectPanel.innerHTML = '<div class="empty-state">' + escapeHtml(message) + '</div>';
    }

    function hydrateFallbackData() {
        if (!state.asteroids.length) {
            setDataSource('Fallback data');
            buildAsteroids(fallbackAsteroids);
        }
        hydrateFallbackFeeds();
    }

    function hydrateFallbackFeeds() {
        state.apiFeeds.asterank = fallbackFeeds.asterank.slice();
        state.apiFeeds.mpc = fallbackFeeds.mpc.slice();
        state.apiFeeds.kepler = fallbackFeeds.kepler.slice();
        state.apiFeeds.skymorph = fallbackFeeds.skymorph.slice();
        renderFeeds();
    }

    function setDataSource(text) {
        state.dataSource = text;
        elements.dataSourceBadge.textContent = text;
    }

    async function fetchSimulationData() {
        setDataSource('Asterank asteroid feed');

        try {
            const response = await fetchJson('asterank_api.php?endpoint=asterank&query=' + encodeURIComponent(DEFAULT_ASTERANK_QUERY) + '&limit=24');
            const asteroids = Array.isArray(response) ? response.map(normalizeAsterankAsteroid).filter(Boolean) : [];
            if (!asteroids.length) {
                throw new Error('Asterank returned no usable orbital records');
            }
            setDataSource('Asterank live data');
            buildAsteroids(asteroids);
            return;
        } catch (error) {
            console.error('Asterank primary feed failed:', error);
        }

        try {
            const response = await fetchJson('asterank_api.php?endpoint=mpc&query=' + encodeURIComponent(DEFAULT_MPC_QUERY) + '&limit=24');
            const asteroids = Array.isArray(response) ? response.map(normalizeMpcAsteroid).filter(Boolean) : [];
            if (!asteroids.length) {
                throw new Error('MPC returned no usable orbital records');
            }
            setDataSource('MPC live data');
            buildAsteroids(asteroids);
            return;
        } catch (error) {
            console.error('MPC fallback failed:', error);
        }

        setDataSource('Fallback data');
        buildAsteroids(fallbackAsteroids);
    }

    async function fetchAllFeeds() {
        const results = await Promise.allSettled([
            fetchJson('asterank_api.php?endpoint=asterank&query=' + encodeURIComponent(DEFAULT_ASTERANK_QUERY) + '&limit=6'),
            fetchJson('asterank_api.php?endpoint=mpc&query=' + encodeURIComponent(DEFAULT_MPC_QUERY) + '&limit=6'),
            fetchJson('asterank_api.php?endpoint=kepler&query=' + encodeURIComponent(DEFAULT_KEPLER_QUERY) + '&limit=6'),
            fetchJson('asterank_api.php?endpoint=skymorph_search&target=' + encodeURIComponent(DEFAULT_SKYMORPH_TARGET))
        ]);

        state.apiFeeds.asterank = results[0].status === 'fulfilled' && Array.isArray(results[0].value) && results[0].value.length
            ? results[0].value
            : state.apiFeeds.asterank;
        state.apiFeeds.mpc = results[1].status === 'fulfilled' && Array.isArray(results[1].value) && results[1].value.length
            ? results[1].value
            : state.apiFeeds.mpc;
        state.apiFeeds.kepler = results[2].status === 'fulfilled' && Array.isArray(results[2].value) && results[2].value.length
            ? results[2].value
            : state.apiFeeds.kepler;
        state.apiFeeds.skymorph = results[3].status === 'fulfilled' && Array.isArray(results[3].value.results) && results[3].value.results.length
            ? results[3].value.results.slice(0, 6)
            : state.apiFeeds.skymorph;
        renderFeeds();
    }

    function setLoadingState() {
        ['asterankFeed', 'mpcFeed', 'keplerFeed', 'skymorphFeed'].forEach(function (key) {
            elements[key].innerHTML = '<div class="loading"></div>';
        });
    }

    function renderFeeds() {
        elements.asterankFeedCount.textContent = state.apiFeeds.asterank.length;
        elements.mpcFeedCount.textContent = state.apiFeeds.mpc.length;
        elements.keplerFeedCount.textContent = state.apiFeeds.kepler.length;
        elements.skymorphFeedCount.textContent = state.apiFeeds.skymorph.length;

        renderFeedList(elements.asterankFeed, state.apiFeeds.asterank, function (row) {
            return feedCard(
                row.full_name || row.name || 'Unknown asteroid',
                [
                    feedMetric('Class', row.class || '--'),
                    feedMetric('Diameter', formatNumber(row.diameter, 2) + ' km'),
                    feedMetric('a', formatNumber(row.a, 3) + ' AU'),
                    feedMetric('e', formatNumber(row.e, 3))
                ]
            );
        }, 'No asteroid records returned.');

        renderFeedList(elements.mpcFeed, state.apiFeeds.mpc, function (row) {
            return feedCard(
                row.readable_des || row.des || 'Unknown MPC object',
                [
                    feedMetric('Epoch', row.epoch || '--'),
                    feedMetric('Obs', row.num_obs || '--'),
                    feedMetric('a', formatNumber(row.a, 3) + ' AU'),
                    feedMetric('i', formatNumber(row.i, 2) + ' deg')
                ]
            );
        }, 'No MPC records returned.');

        renderFeedList(elements.keplerFeed, state.apiFeeds.kepler, function (row) {
            return feedCard(
                'KOI ' + escapeHtml(String(row.KOI || '--')),
                [
                    feedMetric('Period', formatNumber(row.PER, 3) + ' d'),
                    feedMetric('Radius', formatNumber(row.RPLANET, 2) + ' Earth R'),
                    feedMetric('Star Temp', escapeHtml(String(row.TSTAR || '--')) + ' K'),
                    feedMetric('K Mag', formatNumber(row.KMAG, 2))
                ]
            );
        }, 'No Kepler records returned.');

        renderFeedList(elements.skymorphFeed, state.apiFeeds.skymorph, function (row) {
            return feedCard(
                'Obs ' + escapeHtml(String(row.obs_id || '--')),
                [
                    feedMetric('Time', row.time || '--'),
                    feedMetric('Mag', row.mag || '--'),
                    feedMetric('RA', row.predicted_ra || row.ra || '--'),
                    feedMetric('Dec', row.predicted_dec || row.dec || '--')
                ]
            );
        }, 'No SkyMorph observations returned.');
    }

    function renderFeedList(container, rows, renderFn, emptyMessage) {
        if (!rows.length) {
            container.innerHTML = '<div class="empty-state">' + escapeHtml(emptyMessage) + '</div>';
            return;
        }
        container.innerHTML = rows.map(renderFn).join('');
    }

    function feedCard(title, metrics) {
        return '<article class="feed-item"><strong>' + title + '</strong><div class="feed-grid">' + metrics.join('') + '</div></article>';
    }

    function feedMetric(label, value) {
        return '<div><small>' + escapeHtml(String(label)) + '</small><div>' + escapeHtml(String(value)) + '</div></div>';
    }

    async function searchSkyMorph(target) {
        if (!target) {
            elements.targetSearchStatus.textContent = 'Enter an asteroid designation or object name first.';
            return;
        }

        elements.targetSearchStatus.textContent = 'Searching SkyMorph for ' + target + '...';
        try {
            const response = await fetchJson('asterank_api.php?endpoint=skymorph_search&target=' + encodeURIComponent(target));
            const results = Array.isArray(response.results) ? response.results : [];
            if (!results.length) {
                elements.targetSearchStatus.textContent = 'No SkyMorph observations found for ' + target + '.';
                return;
            }

            const first = results[0];
            elements.targetSearchStatus.textContent = results.length + ' SkyMorph observations found for ' + target + '.';
            elements.selectedObjectPanel.innerHTML = [
                '<div class="selected-card">',
                '<div class="selected-head">',
                '<div>',
                '<div class="selected-title">' + escapeHtml(target) + '</div>',
                '<div class="eyebrow">SkyMorph observation match</div>',
                '</div>',
                '<span class="tag tag-safe">Observation</span>',
                '</div>',
                '<div class="selected-grid">',
                metricCell('Predicted RA', first.predicted_ra || first.ra || 'Unknown'),
                metricCell('Predicted Dec', first.predicted_dec || first.dec || 'Unknown'),
                metricCell('Time', first.time || 'Unknown'),
                metricCell('Magnitude', first.mag || 'Unknown'),
                '</div>',
                first.key ? '<img src="asterank_api.php?endpoint=skymorph_image&key=' + encodeURIComponent(first.key) + '" alt="SkyMorph result for ' + escapeHtml(target) + '" style="width:100%;margin-top:1rem;border-radius:20px;border:1px solid rgba(142, 182, 224, 0.18);">' : '',
                '</div>'
            ].join('');
        } catch (error) {
            console.error('SkyMorph search failed:', error);
            elements.targetSearchStatus.textContent = 'SkyMorph lookup failed for ' + target + '.';
        }
    }

    async function fetchJson(url) {
        const controller = new AbortController();
        const timer = setTimeout(function () { controller.abort(); }, 8000);
        try {
            const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
            if (!response.ok) {
                throw new Error('Request failed with status ' + response.status);
            }
            return response.json();
        } finally {
            clearTimeout(timer);
        }
    }

    function normalizeAsterankAsteroid(detail) {
        const semiMajorAxis = parseFloat(detail.a);
        const eccentricity = parseFloat(detail.e);
        const inclination = parseFloat(detail.i);
        const ascendingNodeLongitude = parseFloat(detail.om);
        const perihelionArgument = parseFloat(detail.w);
        const absoluteMagnitude = parseFloat(detail.H);
        const orbitalPeriod = parseFloat(detail.per) || (Number.isNaN(semiMajorAxis) ? NaN : Math.pow(semiMajorAxis, 1.5) * 365.25);
        const diameterKm = parseFloat(detail.diameter) || estimateDiameterFromAbsoluteMagnitude(absoluteMagnitude);

        if ([semiMajorAxis, eccentricity, inclination, ascendingNodeLongitude, perihelionArgument, orbitalPeriod].some(Number.isNaN)) {
            return null;
        }

        return {
            id: String(detail.id || detail.full_name || detail.prov_des || detail.readable_des || Math.random().toString(36).slice(2)),
            name: detail.full_name || detail.readable_des || detail.prov_des || detail.name || 'Unknown asteroid',
            semiMajorAxis: semiMajorAxis,
            eccentricity: eccentricity,
            inclination: inclination,
            ascendingNodeLongitude: ascendingNodeLongitude,
            perihelionArgument: perihelionArgument,
            orbitalPeriod: orbitalPeriod,
            absoluteMagnitude: absoluteMagnitude,
            diameterKm: diameterKm,
            hazardous: Boolean(detail.pha || detail.neo),
            orbitClass: detail.pha ? 'PHA' : (detail.neo ? 'NEO' : 'Asteroid'),
            orbitDescription: detail.spec_B ? 'Spectral type ' + detail.spec_B + ' asteroid from the Asterank catalog.' : 'Asteroid orbit derived from the Asterank catalog.'
        };
    }

    function normalizeMpcAsteroid(detail) {
        const semiMajorAxis = parseFloat(detail.a);
        const eccentricity = parseFloat(detail.e);
        const inclination = parseFloat(detail.i);
        const ascendingNodeLongitude = parseFloat(detail.om);
        const perihelionArgument = parseFloat(detail.w);
        const absoluteMagnitude = parseFloat(detail.H);
        const dailyMotion = parseFloat(detail.d);
        const orbitalPeriod = !Number.isNaN(dailyMotion) && dailyMotion > 0 ? 360 / dailyMotion : (Number.isNaN(semiMajorAxis) ? NaN : Math.pow(semiMajorAxis, 1.5) * 365.25);

        if ([semiMajorAxis, eccentricity, inclination, ascendingNodeLongitude, perihelionArgument, orbitalPeriod].some(Number.isNaN)) {
            return null;
        }

        return {
            id: String(detail.des || detail.readable_des || detail.epoch || Math.random().toString(36).slice(2)),
            name: detail.readable_des || detail.des || 'Unknown MPC object',
            semiMajorAxis: semiMajorAxis,
            eccentricity: eccentricity,
            inclination: inclination,
            ascendingNodeLongitude: ascendingNodeLongitude,
            perihelionArgument: perihelionArgument,
            orbitalPeriod: orbitalPeriod,
            absoluteMagnitude: absoluteMagnitude,
            diameterKm: estimateDiameterFromAbsoluteMagnitude(absoluteMagnitude),
            hazardous: false,
            orbitClass: 'MPC Orbit',
            orbitDescription: 'MPC orbital record with ' + (detail.num_obs || 'unknown') + ' observations.'
        };
    }

    function estimateDiameterFromAbsoluteMagnitude(absoluteMagnitude) {
        if (absoluteMagnitude === null || absoluteMagnitude === undefined || Number.isNaN(Number(absoluteMagnitude))) {
            return 0.2;
        }
        const albedo = 0.14;
        return (1329 / Math.sqrt(albedo)) * Math.pow(10, -Number(absoluteMagnitude) / 5) / 1000;
    }

    function formatNumber(value, decimals) {
        const number = Number(value);
        if (Number.isNaN(number)) {
            return '--';
        }
        return number.toFixed(decimals);
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ---- Focused mode: show a single asteroid from parent app ----

    function enterFocusedMode(data) {
        var a = parseFloat(data.a);
        var e = parseFloat(data.e);
        var i = parseFloat(data.i);
        var om = parseFloat(data.om);
        var w = parseFloat(data.w);
        if ([a, e, i, om, w].some(Number.isNaN)) return;

        var per = parseFloat(data.per);
        if (!Number.isFinite(per) || per <= 0) per = Math.pow(a, 1.5) * 365.25;
        var diameterKm = parseFloat(data.diameterKm);
        if (!Number.isFinite(diameterKm) || diameterKm <= 0) diameterKm = 0.5;

        var asteroid = {
            id: String(data.id || data.name || 'focused'),
            name: String(data.name || 'Unknown'),
            semiMajorAxis: a,
            eccentricity: e,
            inclination: i,
            ascendingNodeLongitude: om,
            perihelionArgument: w,
            orbitalPeriod: per,
            absoluteMagnitude: 20,
            diameterKm: diameterKm,
            hazardous: Boolean(data.hazardous),
            orbitClass: String(data.orbitClass || 'NEO'),
            orbitDescription: 'Orbit data from JPL SBDB, viewed from asteroid panel.'
        };

        state.focusedMode = true;
        state.focusedName = asteroid.name;

        buildAsteroids([asteroid]);
        selectAsteroid(asteroid.id, true);
        setDataSource('Focused: ' + asteroid.name);

        if (elements.focusedBanner) {
            elements.focusedBanner.style.display = '';
            if (elements.focusedLabel) elements.focusedLabel.textContent = '🎯 ' + asteroid.name;
        }
    }

    function exitFocusedMode() {
        state.focusedMode = false;
        state.focusedName = '';
        if (elements.focusedBanner) {
            elements.focusedBanner.style.display = 'none';
        }
        fetchSimulationData();
        fetchAllFeeds();
    }

    window.addEventListener('message', function (event) {
        if (event.origin !== window.location.origin) return;
        if (event.data && event.data.type === 'showAsteroid' && event.data.asteroid) {
            enterFocusedMode(event.data.asteroid);
        }
    });
})();