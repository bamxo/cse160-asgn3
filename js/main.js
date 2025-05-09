// WebGL globals
let gl;
let canvas;
let modelMatrix;
let world;
let camera;
let lastTime = 0;
let fpsCounter;
let program;
let fpsHistory = []; // Track recent FPS for smoothing
let frameCount = 0;
let lastFpsUpdate = 0;
let renderingPaused = false;
let lowResolutionMode = false; // Changed to false for higher default resolution
let texturesInitialized = false;
let loadingMessage = null;
let highPerformanceMode = true; // Added flag for high performance mode

// Panda Rescue Quest UI elements
let pandaCounter;
let winMessage;

// Shader attribute and uniform locations
let a_Position;
let a_Normal;
let a_TexCoord;
let u_ModelMatrix;
let u_ViewMatrix;
let u_ProjectionMatrix;
let u_Color;
let u_TextureWeight;
let u_Sampler;
let u_Alpha;

// Keyboard state
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  q: false,
  e: false,
  p: false,
  space: false,
  shift: false,
  f: false,
  g: false
};

// HTML elements
let targetBlockInfo;
let blockCounter;

// GLSL Shaders - Ultra simplified for better performance
const VERTEX_SHADER = `
  attribute vec3 a_Position;
  attribute vec3 a_Normal;
  attribute vec2 a_TexCoord;
  
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  
  // Pass to fragment shader
  varying vec3 v_Normal;
  varying vec2 v_TexCoord;
  varying vec3 v_Position;
  
  void main() {
    vec4 worldPosition = u_ModelMatrix * vec4(a_Position, 1.0);
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * worldPosition;
    v_TexCoord = a_TexCoord;
    v_Normal = a_Normal;
    v_Position = worldPosition.xyz;
  }
`;

const FRAGMENT_SHADER = `
  precision highp float; // Changed to highp for better precision
  
  varying vec3 v_Normal;
  varying vec2 v_TexCoord;
  varying vec3 v_Position;
  
  uniform vec3 u_Color;
  uniform float u_TextureWeight;
  uniform sampler2D u_Sampler;
  uniform float u_Alpha;
  
  void main() {
    // Higher quality texture sampling
    vec4 texColor = texture2D(u_Sampler, v_TexCoord);
    
    // Enhanced lighting calculation - adjusted for more even lighting
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8)); // More balanced light direction
    vec3 normal = normalize(v_Normal);
    float diffuse = max(dot(normal, lightDir), 0.0);
    float ambient = 0.6; // Increased ambient light to reduce shadow contrast
    float light = ambient + diffuse * 0.4; // Reduced diffuse influence for more even lighting
    
    // Mix the color with texture based on texture weight
    vec3 finalColor = mix(u_Color, texColor.rgb, u_TextureWeight) * light;
    
    // Use the alpha uniform for transparency
    gl_FragColor = vec4(finalColor, u_Alpha);
  }
`;

// Initialize WebGL and set up the scene
function initWebGL() {
  // Get canvas and initialize WebGL context
  canvas = document.getElementById('webgl');
  
  // Set canvas to a higher resolution for better clarity
  if (lowResolutionMode) {
    canvas.width = 800;  // Increased from 600
    canvas.height = 600; // Increased from 450
  } else {
    canvas.width = 1400; // Increased from default in HTML
    canvas.height = 800; // Increased from default in HTML
  }
  
  // Create WebGL context with additional performance hints
  const contextOptions = {
    alpha: false,              // No alpha in the backbuffer
    depth: true,               // Use depth buffer
    stencil: false,            // No stencil buffer needed
    antialias: true,           // Enable antialiasing for better quality
    powerPreference: 'high-performance', // Request high-performance GPU
    failIfMajorPerformanceCaveat: false  // Allow fallbacks
  };
  
  // Try to get WebGL2 first, then fall back to WebGL1
  gl = canvas.getContext('webgl2', contextOptions) || 
       canvas.getContext('webgl', contextOptions) || 
       canvas.getContext('experimental-webgl', contextOptions);
       
  if (!gl) {
    console.error('Failed to get the WebGL context');
    return false;
  }
  
  // Initialize shaders
  if (!initShaders(gl, VERTEX_SHADER, FRAGMENT_SHADER)) {
    console.error('Failed to initialize shaders');
    return false;
  }
  
  // Get attribute and uniform locations
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
  a_TexCoord = gl.getAttribLocation(gl.program, 'a_TexCoord');
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  u_Color = gl.getUniformLocation(gl.program, 'u_Color');
  u_TextureWeight = gl.getUniformLocation(gl.program, 'u_TextureWeight');
  u_Sampler = gl.getUniformLocation(gl.program, 'u_Sampler');
  u_Alpha = gl.getUniformLocation(gl.program, 'u_Alpha');
  
  if (a_Position < 0 || a_TexCoord < 0 || 
      u_ModelMatrix == null || u_ViewMatrix == null || 
      u_ProjectionMatrix == null || u_Color == null || 
      u_TextureWeight == null || u_Sampler == null ||
      u_Alpha == null) {
    console.error('Failed to get attribute or uniform locations');
    return false;
  }
  
  // Set default alpha to 1.0 (fully opaque)
  gl.uniform1f(u_Alpha, 1.0);
  
  // Store the WebGL program for later use
  program = gl.program;
  
  // Set WebGL options for better performance
  gl.clearColor(0.5, 0.8, 1.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  
  // Set additional performance options
  if (highPerformanceMode) {
    gl.hint(gl.GENERATE_MIPMAP_HINT, gl.FASTEST);
    gl.disable(gl.DITHER);
    
    // Don't perform depth operations on fragments that will be discarded
    if (gl.getExtension('EXT_discard_framebuffer')) {
      console.log('Using discard framebuffer extension for better performance');
    }
  }
  
  // Initialize matrices
  modelMatrix = new Matrix4();
  
  // Create and initialize the world first
  world = new World(gl, 16); // Use an even smaller world size for performance
  
  // Create and initialize camera
  camera = new Camera(canvas);
  // Position camera in the center of the world
  const worldCenter = Math.floor(world.size / 2);
  camera.eye = new Vector3([worldCenter, 1.0, worldCenter]);
  camera.at = new Vector3([worldCenter, 1.0, worldCenter - 1]);
  // Set the world reference for terrain height adjustment
  camera.setWorld(world);
  camera.updateViewMatrix();
  
  // Enable mouse control
  camera.enableMouseControl(canvas);
  
  // Success
  return true;
}

// Initialize resources and start rendering
function initResources() {
  // Create loading message
  loadingMessage = document.createElement('div');
  loadingMessage.style.position = 'absolute';
  loadingMessage.style.top = '50%';
  loadingMessage.style.left = '50%';
  loadingMessage.style.transform = 'translate(-50%, -50%)';
  loadingMessage.style.background = 'rgba(0, 0, 0, 0.7)';
  loadingMessage.style.color = 'white';
  loadingMessage.style.padding = '20px';
  loadingMessage.style.borderRadius = '5px';
  loadingMessage.style.fontSize = '18px';
  loadingMessage.textContent = 'Loading textures...';
  document.body.appendChild(loadingMessage);
  
  // Start with world initialization without textures
  world.init();
  
  // Initialize textures synchronously to ensure they're ready immediately
  const numTextures = world.initTextures();
  console.log(`Generated ${numTextures} textures`);
  texturesInitialized = true;
  
  // Apply textures immediately
  world.applyTextures();
  
  // Remove loading message
  if (loadingMessage) {
    document.body.removeChild(loadingMessage);
    loadingMessage = null;
  }
  
  // Start rendering
  requestAnimationFrame(render);
}

// Check for key-specific actions
function checkKeyActions() {
  // P key toggles panda animations
  if (keys.p) {
    world.togglePandaAnimations();
    keys.p = false; // Reset so it only fires once per press
  }
  
  // F key to remove blocks (alternate to left click)
  if (keys.f) {
    const targetBlock = world.findTargetBlock(camera);
    if (targetBlock) {
      console.log("F key pressed - removing block:", targetBlock);
      
      // Try removing the block
      const success = world.removeBlock(targetBlock.x, targetBlock.y, targetBlock.z);
      
      // Log result
      if (success) {
        console.log(`Successfully removed block at (${targetBlock.x}, ${targetBlock.y}, ${targetBlock.z})`);
        
        // Update UI with success message
        if (targetBlockInfo) {
          targetBlockInfo.textContent = `Removed block at (${targetBlock.x}, ${targetBlock.y}, ${targetBlock.z})`;
          // Reset after 2 seconds
          setTimeout(() => {
            const newTargetBlock = world.findTargetBlock(camera);
            targetBlockInfo.textContent = newTargetBlock ? 
              `Target: (${newTargetBlock.x}, ${newTargetBlock.y}, ${newTargetBlock.z})` : 
              'No target block';
          }, 2000);
        }
      } else {
        console.log(`Failed to remove block at (${targetBlock.x}, ${targetBlock.y}, ${targetBlock.z})`);
        
        // Update UI with failure message
        if (targetBlockInfo) {
          targetBlockInfo.textContent = `Failed to remove block at (${targetBlock.x}, ${targetBlock.y}, ${targetBlock.z})`;
          // Reset after 2 seconds
          setTimeout(() => {
            const newTargetBlock = world.findTargetBlock(camera);
            targetBlockInfo.textContent = newTargetBlock ? 
              `Target: (${newTargetBlock.x}, ${newTargetBlock.y}, ${newTargetBlock.z})` : 
              'No target block';
          }, 2000);
        }
      }
    } else {
      console.log("F key pressed but no target block found");
      
      // Update UI with no target message
      if (targetBlockInfo) {
        targetBlockInfo.textContent = 'No target block to remove';
        // Reset after 2 seconds
        setTimeout(() => {
          targetBlockInfo.textContent = 'No target block';
        }, 2000);
      }
    }
    keys.f = false; // Reset so it only fires once per press
  }
  
  // G key to add blocks (alternate to right click)
  if (keys.g) {
    // Find target block for placement
    const targetBlock = world.findTargetBlock(camera);
    if (targetBlock) {
      console.log("G key pressed - adding block near:", targetBlock);
      
      // Calculate placement position using grid-based rules
      const placementPosition = calculateGridPlacementPosition(targetBlock, camera);
      
      if (placementPosition) {
        // Add the block at the calculated position
        let success;
        
        // Check if this is terrain placement and pass terrain height if needed
        if (placementPosition.y === -2 && placementPosition.terrainHeight !== undefined) {
          success = world.addBlock(
            placementPosition.x, 
            placementPosition.y, 
            placementPosition.z, 
            1, // height
            placementPosition.terrainHeight
          );
        } else {
          success = world.addBlock(placementPosition.x, placementPosition.y, placementPosition.z);
        }
        
        // Log the result
        if (success) {
          console.log(`Successfully added block at (${placementPosition.x}, ${placementPosition.y}, ${placementPosition.z})`);
          
          // Update UI with success message
          if (targetBlockInfo) {
            targetBlockInfo.textContent = `Added block at (${placementPosition.x}, ${placementPosition.y}, ${placementPosition.z})`;
            // Reset after 2 seconds
            setTimeout(() => {
              const newTargetBlock = world.findTargetBlock(camera);
              targetBlockInfo.textContent = newTargetBlock ? 
                `Target: (${newTargetBlock.x}, ${newTargetBlock.y}, ${newTargetBlock.z})` : 
                'No target block';
            }, 2000);
          }
        } else {
          console.log(`Failed to add block at (${placementPosition.x}, ${placementPosition.y}, ${placementPosition.z})`);
          
          // Update UI with failure message
          if (targetBlockInfo) {
            targetBlockInfo.textContent = `Failed to add block at (${placementPosition.x}, ${placementPosition.y}, ${placementPosition.z})`;
            // Reset after 2 seconds
            setTimeout(() => {
              const newTargetBlock = world.findTargetBlock(camera);
              targetBlockInfo.textContent = newTargetBlock ? 
                `Target: (${newTargetBlock.x}, ${newTargetBlock.y}, ${newTargetBlock.z})` : 
                'No target block';
            }, 2000);
          }
        }
      } else {
        console.log("Failed to calculate valid placement position");
        
        // Update UI with placement failure message
        if (targetBlockInfo) {
          targetBlockInfo.textContent = 'Invalid block placement position';
          // Reset after 2 seconds
          setTimeout(() => {
            const newTargetBlock = world.findTargetBlock(camera);
            targetBlockInfo.textContent = newTargetBlock ? 
              `Target: (${newTargetBlock.x}, ${newTargetBlock.y}, ${newTargetBlock.z})` : 
              'No target block';
          }, 2000);
        }
      }
    } else {
      console.log("G key pressed but no target block found");
      
      // Update UI with no target message
      if (targetBlockInfo) {
        targetBlockInfo.textContent = 'No target block to place near';
        // Reset after 2 seconds
        setTimeout(() => {
          targetBlockInfo.textContent = 'No target block';
        }, 2000);
      }
    }
    keys.g = false; // Reset so it only fires once per press
  }
}

// Helper function to calculate grid-based placement position
function calculateGridPlacementPosition(targetBlock, camera) {
  console.log("calculateGridPlacementPosition called with:", targetBlock);
  
  // Special case for terrain placement (y = -2)
  if (targetBlock.isTerrain || targetBlock.y === -2) {
    console.log("Placing block on terrain at:", targetBlock.x, targetBlock.terrainHeight, targetBlock.z);
    
    // Check if there are already blocks at this position
    const terrainBlockExists = world.map[targetBlock.x][targetBlock.z] > 0;
    console.log("Terrain already has blocks:", terrainBlockExists, "Height:", world.map[targetBlock.x][targetBlock.z]);
    
    return {
      x: targetBlock.x,
      y: -2, // Special marker for terrain placement
      z: targetBlock.z,
      terrainHeight: targetBlock.terrainHeight
    };
  }
  
  // Special case for floor (y = -1)
  if (targetBlock.isFloor || targetBlock.y === -1) {
    console.log("Placing block on floor at:", targetBlock.x, 0, targetBlock.z);
    return {
      x: targetBlock.x,
      y: 0, // Place on the ground
      z: targetBlock.z
    };
  }
  
  // Special case for tree blocks
  if (targetBlock.isTreeBlock) {
    console.log("Target is a tree block - special handling");
    
    // Get camera position and direction
    const dir = new Vector3();
    dir.elements[0] = camera.at.elements[0] - camera.eye.elements[0];
    dir.elements[1] = camera.at.elements[1] - camera.eye.elements[1];
    dir.elements[2] = camera.at.elements[2] - camera.eye.elements[2];
    dir.normalize();
    
    // Calculate normal of the hit face (simplified)
    const hitX = targetBlock.x + 0.5;
    const hitY = targetBlock.y + 0.5;
    const hitZ = targetBlock.z + 0.5;
    
    const dx = hitX - camera.eye.elements[0];
    const dy = hitY - camera.eye.elements[1];
    const dz = hitZ - camera.eye.elements[2];
    
    console.log("Hit tree block at coordinates:", hitX, hitY, hitZ);
    console.log("Delta to camera:", dx, dy, dz);
    
    // Determine which face was hit (largest component is the normal)
    let nx = 0, ny = 0, nz = 0;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > Math.abs(dz)) {
      nx = Math.sign(dx);
    } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > Math.abs(dz)) {
      ny = Math.sign(dy);
    } else {
      nz = Math.sign(dz);
    }
    
    console.log("Tree block normal direction:", nx, ny, nz);
    
    // Place block adjacent to hit face
    const newX = targetBlock.x + nx;
    const newY = targetBlock.y + ny;
    const newZ = targetBlock.z + nz;
    
    console.log(`Placing block adjacent to tree: (${newX}, ${newY}, ${newZ})`);
    
    // Enforce minimum Y of 0 (can't place below ground)
    const finalY = Math.max(0, newY);
    
    // Ensure we're in world bounds
    if (newX < 0 || newX >= world.size || newZ < 0 || newZ >= world.size) {
      console.log("Block would be placed outside world bounds");
      return null;
    }
    
    return { x: newX, y: finalY, z: newZ };
  }
  
  // Regular blocks
  // Get camera position and direction
  const dir = new Vector3();
  dir.elements[0] = camera.at.elements[0] - camera.eye.elements[0];
  dir.elements[1] = camera.at.elements[1] - camera.eye.elements[1];
  dir.elements[2] = camera.at.elements[2] - camera.eye.elements[2];
  dir.normalize();
  
  // Calculate normal of the hit face (simplified)
  const hitX = targetBlock.x + 0.5;
  const hitY = targetBlock.y + 0.5;
  const hitZ = targetBlock.z + 0.5;
  
  const dx = hitX - camera.eye.elements[0];
  const dy = hitY - camera.eye.elements[1];
  const dz = hitZ - camera.eye.elements[2];
  
  console.log("Hit coordinates:", hitX, hitY, hitZ);
  console.log("Delta to camera:", dx, dy, dz);
  
  // Determine which face was hit (largest component is the normal)
  let nx = 0, ny = 0, nz = 0;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > Math.abs(dz)) {
    nx = Math.sign(dx);
  } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > Math.abs(dz)) {
    ny = Math.sign(dy);
  } else {
    nz = Math.sign(dz);
  }
  
  console.log("Normal direction:", nx, ny, nz);
  
  // Place block adjacent to hit face
  const newX = targetBlock.x + nx;
  const newY = targetBlock.y + ny;
  const newZ = targetBlock.z + nz;
  
  console.log(`Placing block adjacent to face: (${newX}, ${newY}, ${newZ})`);
  
  // Enforce minimum Y of 0 (can't place below ground)
  const finalY = Math.max(0, newY);
  if (finalY !== newY) {
    console.log(`Corrected Y from ${newY} to ${finalY} (minimum 0)`);
  }
  
  // Check if new position is valid (not colliding with player)
  const playerPosX = Math.floor(camera.eye.elements[0]);
  const playerPosY = Math.floor(camera.eye.elements[1]);
  const playerPosZ = Math.floor(camera.eye.elements[2]);
  
  console.log("Player position:", playerPosX, playerPosY, playerPosZ);
  
  // Don't allow placing a block where the player is standing
  if (newX === playerPosX && finalY === playerPosY && newZ === playerPosZ) {
    console.log("Can't place block at player position");
    return null;
  }
  
  // Ensure we're in world bounds
  if (newX < 0 || newX >= world.size || newZ < 0 || newZ >= world.size) {
    console.log("Block would be placed outside world bounds");
    return null;
  }
  
  return { x: newX, y: finalY, z: newZ };
}

// Update the game state
function updateGame(deltaTime) {
  // Skip updating if paused or deltaTime is unreasonable
  if (renderingPaused || deltaTime > 1000) {
    return;
  }
  
  // Calculate movement speed based on deltaTime
  const moveSpeed = 0.1 * (deltaTime / 16.67); // normalize to 60fps
  
  // Get player position from camera for collision detection
  // Assuming we're using the camera eye position as the player position
  const playerPos = camera.getPosition();
  
  // Update world player position for game logic (Panda Rescue Quest)
  world.setPlayerPosition(playerPos[0], playerPos[1], playerPos[2]);
  
  // Apply movement based on keys pressed
  const moveDirection = [0, 0, 0];
  
  if (keys.w) moveDirection[2] -= 1;
  if (keys.s) moveDirection[2] += 1;
  if (keys.a) moveDirection[0] -= 1;
  if (keys.d) moveDirection[0] += 1;
  
  // Normalize movement direction to prevent faster diagonal movement
  const moveLength = Math.sqrt(
    moveDirection[0] * moveDirection[0] + 
    moveDirection[2] * moveDirection[2]
  );
  
  if (moveLength > 0) {
    moveDirection[0] /= moveLength;
    moveDirection[2] /= moveLength;
  }
  
  // Only move if there's a direction
  if (moveLength > 0) {
    // Apply move direction in camera's local space
    camera.moveForward(-moveDirection[2] * moveSpeed); // Invert Z direction to fix W/S keys
    camera.moveRight(moveDirection[0] * moveSpeed);
  }
  
  // Apply vertical movement
  if (keys.space) {
    camera.moveUp(moveSpeed * 0.8); // Jump/fly upward
  }
  if (keys.shift) {
    camera.moveUp(-moveSpeed * 0.8); // Move downward
  }
  
  // Handle camera rotation
  if (keys.q) camera.panLeft();
  if (keys.e) camera.panRight();
  
  // Only update target block when needed (movement occurred or mouse moved)
  const movementUpdate = (keys.w || keys.s || keys.a || keys.d || keys.q || keys.e || keys.space || keys.shift);
  
  if (movementUpdate || camera.mouseMovedSinceLastFrame) {
    // Find target block for minecraft-style interaction
    const targetBlock = world.findTargetBlock(camera);
    
    // Update UI with target block info
    if (targetBlockInfo) {
      if (targetBlock) {
        // Create a more descriptive message
        let targetMessage = `Target Block: (${targetBlock.x}, ${targetBlock.y}, ${targetBlock.z})`;
        
        // Special info for floor targets
        if (targetBlock.isFloor) {
          targetMessage += ' [Floor]';
          targetBlockInfo.style.color = '#7dcc7d'; // Green for floor targets
        } 
        // Special info for tree blocks
        else if (targetBlock.isTreeBlock) {
          targetMessage += ' [Tree]';
          targetBlockInfo.style.color = '#a67c52'; // Brown for tree targets
        } 
        // Regular blocks
        else {
          targetBlockInfo.style.color = 'white'; // Reset to default
        }
        
        targetBlockInfo.textContent = targetMessage;
      } else {
        targetBlockInfo.textContent = 'No target block';
        targetBlockInfo.style.color = 'white'; // Reset to default
      }
    }
    
    camera.mouseMovedSinceLastFrame = false;
  }
  
  // Update world state (pandas, terrain, etc.)
  world.update(deltaTime);
  
  // Update collision detection and block placement logic
  checkKeyActions();
}

// Update UI elements for Panda Rescue Quest
function updatePandaQuestUI() {
  // Update panda counter
  if (pandaCounter) {
    pandaCounter.textContent = `Pandas Found: ${world.gameState.foundBabyPandas}/${world.gameState.totalBabyPandas}`;
  }
  
  // Show win message if game is won
  if (winMessage) {
    const gameWon = world.gameState.gameWon;
    winMessage.style.display = gameWon ? 'block' : 'none';
    
    // Hide crosshair when win screen is displayed
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
      crosshair.style.display = gameWon ? 'none' : 'block';
    }
  }
}

// Render the scene
function render(currentTime) {
  // Skip if rendering is paused
  if (renderingPaused) {
    requestAnimationFrame(render);
    return;
  }
  
  // Calculate delta time between frames
  const deltaTime = lastTime ? currentTime - lastTime : 0;
  lastTime = currentTime;
  
  // Skip if the deltaTime is too large (browser tab was inactive)
  if (deltaTime > 1000) {
    requestAnimationFrame(render);
    return;
  }
  
  // Update FPS counter
  frameCount++;
  if (currentTime - lastFpsUpdate > 1000) { // update every second
    if (fpsCounter) {
      // Calculate FPS with weighted average for smoother display
      const fps = Math.round(frameCount * 1000 / (currentTime - lastFpsUpdate));
      fpsHistory.push(fps);
      
      // Keep history limited to 5 entries
      if (fpsHistory.length > 5) fpsHistory.shift();
      
      // Calculate average FPS
      const averageFps = Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length);
      
      fpsCounter.textContent = `FPS: ${averageFps}`;
    }
    lastFpsUpdate = currentTime;
    frameCount = 0;
  }
  
  // Clear the canvas
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  // Update the camera based on movement in updateGame
  updateGame(deltaTime);
  
  // Set the view and projection matrices
  gl.uniformMatrix4fv(u_ViewMatrix, false, camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);
  
  // Initialize model matrix
  modelMatrix.setIdentity();
  
  // Render the world
  world.render(gl, modelMatrix, camera, u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, u_Color, u_TextureWeight, u_Sampler);
  
  // Update panda rescue UI elements
  updatePandaQuestUI();
  
  // Continue the render loop
  requestAnimationFrame(render);
}

// Initialize when the page loads
function main() {
  // Set up UI elements
  fpsCounter = document.getElementById('fpsCounter');
  targetBlockInfo = document.getElementById('targetBlockInfo');
  blockCounter = document.getElementById('blockCounter');
  
  // Make sure the hotbar is visible initially
  const hotbar = document.getElementById('hotbar');
  if (hotbar) {
    hotbar.style.opacity = '1';
    console.log('Initialized hotbar');
    
    // Apply textures to all hotbar items immediately
    setTimeout(() => {
      // The background styles for each block type
      const backgroundStyles = [
        'linear-gradient(to bottom, #7dcc7d 70%, #997950 30%)', // Grass
        'radial-gradient(#8a6840 15%, transparent 15%), radial-gradient(#8a6840 15%, transparent 15%)', // Dirt
        'radial-gradient(#999 20%, transparent 20%), radial-gradient(#999 20%, transparent 20%)', // Stone
        'repeating-linear-gradient(90deg, #8d6239 0px, #8d6239 4px, #a67c52 4px, #a67c52 8px)', // Wood
        'radial-gradient(#2a541a 15%, transparent 15%), radial-gradient(#2a541a 15%, transparent 15%)', // Leaves
        'linear-gradient(#853333 2px, transparent 2px), linear-gradient(90deg, #853333 2px, transparent 2px)' // Brick
      ];
      
      const backgroundColors = ['#7dcc7d', '#997950', '#aaaaaa', '#a67c52', '#3d7a25', '#aa4444'];
      
      const slots = document.querySelectorAll('.hotbar-slot');
      slots.forEach(slot => {
        const slotIndex = parseInt(slot.dataset.index);
        
        // Find the hotbar item inside this slot
        const item = slot.querySelector('.hotbar-item');
        if (item) {
          console.log(`Found item in slot ${slotIndex}`);
          // Make sure all items have their textures set
          if (slotIndex < backgroundStyles.length) {
            item.style.backgroundImage = backgroundStyles[slotIndex];
            item.style.backgroundColor = backgroundColors[slotIndex];
            console.log(`Applied texture to item ${slotIndex}`);
          }
        } else {
          console.log(`No item found in slot ${slotIndex}`);
        }
      });
      
      // Set up click event listeners for hotbar slots
      slots.forEach(slot => {
        slot.addEventListener('click', () => {
          const slotIndex = parseInt(slot.dataset.index);
          console.log(`Clicked on hotbar slot ${slotIndex}`);
          selectHotbarSlot(slotIndex);
        });
      });
    }, 100);
  }
  
  const crosshair = document.getElementById('crosshair');
  if (crosshair) {
    crosshair.style.display = 'block';
    console.log('Initialized crosshair');
  }
  
  // Initialize WebGL
  if (!initWebGL()) {
    console.error('Failed to initialize WebGL');
    return;
  }
  
  // Set up event listeners
  initEventListeners();
  
  // Initialize resources and start rendering
  initResources();
  
  // Create UI elements for Panda Rescue Quest
  createPandaQuestUI();
}

// Set up event listeners for keyboard and mouse
function initEventListeners() {
  // Keyboard events
  document.addEventListener('keydown', (event) => {
    const keyPressed = event.key.toLowerCase();
    
    // Log every keydown event
    console.log('Keydown in initEventListeners:', keyPressed);
    
    // Direct handler for number keys (1-6) for hotbar selection
    if (keyPressed >= '1' && keyPressed <= '6') {
      const index = parseInt(keyPressed) - 1;
      console.log(`Number key ${keyPressed} pressed - selecting slot ${index}`);
      selectHotbarSlot(index);
      // Don't return here, still need to handle the key in handleKeyDown
    }
    
    // Handle all keys through the regular handler
    handleKeyDown(keyPressed);
  });
  
  document.addEventListener('keyup', (event) => {
    handleKeyUp(event.key.toLowerCase());
  });
  
  // Mouse movement for camera
  document.addEventListener('mousemove', (event) => {
    // Always pass the event to the camera handler
    // which will now properly handle both pointer lock and regular mouse movement
    camera.handleMouseMove(event, canvas);
  });
  
  // Mouse click for block interaction and panda interaction
  canvas.addEventListener('click', () => {
    // Check if we're looking at a panda
    const targetPanda = world.findTargetPanda(camera);
    if (targetPanda) {
      // Click on a panda to make it animate
      targetPanda.panda.toggleAnimation();
      return;
    }
    
    // Otherwise, try to remove a block
    const targetBlock = world.findTargetBlock(camera);
    if (targetBlock) {
      console.log("Left click on block:", targetBlock);
      
      // Try to remove the block
      const success = world.removeBlock(targetBlock.x, targetBlock.y, targetBlock.z);
      
      // Log the result
      if (success) {
        console.log(`Successfully removed block at (${targetBlock.x}, ${targetBlock.y}, ${targetBlock.z})`);
      } else {
        console.log(`Failed to remove block at (${targetBlock.x}, ${targetBlock.y}, ${targetBlock.z})`);
      }
    }
  });
  
  // Right-click for adding blocks
  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    const targetBlock = world.findTargetBlock(camera);
    if (targetBlock) {
      console.log("Right click on block:", targetBlock);
      
      // Calculate placement position
      const placementPosition = calculateGridPlacementPosition(targetBlock, camera);
      
      if (placementPosition) {
        // Try to add the block
        const success = world.addBlock(placementPosition.x, placementPosition.y, placementPosition.z);
        
        // Log the result
        if (success) {
          console.log(`Successfully added block at (${placementPosition.x}, ${placementPosition.y}, ${placementPosition.z})`);
        } else {
          console.log(`Failed to add block at (${placementPosition.x}, ${placementPosition.y}, ${placementPosition.z})`);
        }
      } else {
        console.log("Failed to calculate valid placement position");
      }
    }
  });
  
  // Handle pointer lock change
  document.addEventListener('pointerlockchange', lockChangeAlert, false);
  document.addEventListener('mozpointerlockchange', lockChangeAlert, false);
  document.addEventListener('webkitpointerlockchange', lockChangeAlert, false);
  
  function lockChangeAlert() {
    if (document.pointerLockElement === canvas || 
        document.mozPointerLockElement === canvas ||
        document.webkitPointerLockElement === canvas) {
      console.log('Pointer lock active');
      // Ensure mouse control is enabled
      camera.mouseEnabled = true;
    } else {
      console.log('Pointer lock inactive');
      // We still want to keep the mouse enabled for when the user clicks again
      // but it won't do anything until pointer is locked again
    }
  }
}

// Handle key down events
function handleKeyDown(key) {
  console.log('Key pressed:', key);
  
  switch (key) {
    case 'w': keys.w = true; break;
    case 'a': keys.a = true; break;
    case 's': keys.s = true; break;
    case 'd': keys.d = true; break;
    case 'q': keys.q = true; break;
    case 'e': keys.e = true; break;
    case 'p': keys.p = true; break;
    case 'f': keys.f = true; break;
    case 'g': keys.g = true; break;
    case ' ': keys.space = true; break;
    case 'shift': keys.shift = true; break;
    
    // Number keys are handled directly in the keydown event listener
  }
}

// Handle key up events
function handleKeyUp(key) {
  switch (key) {
    case 'w': keys.w = false; break;
    case 'a': keys.a = false; break;
    case 's': keys.s = false; break;
    case 'd': keys.d = false; break;
    case 'q': keys.q = false; break;
    case 'e': keys.e = false; break;
    case 'p': keys.p = false; break;
    case 'f': keys.f = false; break;
    case 'g': keys.g = false; break;
    case ' ': keys.space = false; break;
    case 'shift': keys.shift = false; break;
  }
}

// Helper function to select a hotbar slot
function selectHotbarSlot(index) {
  console.log('selectHotbarSlot called with index:', index);
  
  // Validate index to avoid errors
  if (index < 0 || index > 5) {
    console.error(`Invalid hotbar index: ${index}`);
    return;
  }
  
  // Update the selected block type in the world
  if (world && world.minecraft) {
    // First ensure the blockTypes array exists
    if (!world.minecraft.blockTypes || !Array.isArray(world.minecraft.blockTypes)) {
      console.error('world.minecraft.blockTypes is not properly initialized');
      return;
    }
    
    // Check if index is within valid range before accessing blockTypes
    if (index >= 0 && index < world.minecraft.blockTypes.length) {
      // Update the selected block type index
      world.minecraft.selectedBlockTypeIndex = index;
      console.log('Updated world.minecraft.selectedBlockTypeIndex to', index);
      
      // The background styles for each block type
      const backgroundStyles = [
        'linear-gradient(to bottom, #7dcc7d 70%, #997950 30%)', // Grass
        'radial-gradient(#8a6840 15%, transparent 15%), radial-gradient(#8a6840 15%, transparent 15%)', // Dirt
        'radial-gradient(#999 20%, transparent 20%), radial-gradient(#999 20%, transparent 20%)', // Stone
        'repeating-linear-gradient(90deg, #8d6239 0px, #8d6239 4px, #a67c52 4px, #a67c52 8px)', // Wood
        'radial-gradient(#2a541a 15%, transparent 15%), radial-gradient(#2a541a 15%, transparent 15%)', // Leaves
        'linear-gradient(#853333 2px, transparent 2px), linear-gradient(90deg, #853333 2px, transparent 2px)' // Brick
      ];
      
      const backgroundColors = ['#7dcc7d', '#997950', '#aaaaaa', '#a67c52', '#3d7a25', '#aa4444'];
      
      // Update visual selection in the UI
      const slots = document.querySelectorAll('.hotbar-slot');
      console.log('Found', slots.length, 'hotbar slots');
      
      slots.forEach(slot => {
        slot.classList.remove('selected');
        const slotIndex = parseInt(slot.dataset.index);
        console.log('Checking slot with index:', slotIndex);
        
        // Find the hotbar item inside this slot
        const item = slot.querySelector('.hotbar-item');
        if (item) {
          // Make sure all items have their textures set
          if (slotIndex < backgroundStyles.length) {
            item.style.backgroundImage = backgroundStyles[slotIndex];
            item.style.backgroundColor = backgroundColors[slotIndex];
          }
        }
        
        if (slotIndex === index) {
          console.log('Adding selected class to slot', slotIndex);
          slot.classList.add('selected');
        }
      });
      
      // Show a message about the selected block
      try {
        const blockName = world.minecraft.blockTypes[index].name;
        const targetBlockInfo = document.getElementById('targetBlockInfo');
        if (targetBlockInfo) {
          targetBlockInfo.textContent = `Selected: ${blockName}`;
          // Reset after 2 seconds
          setTimeout(() => {
            const targetBlock = world.findTargetBlock(camera);
            targetBlockInfo.textContent = targetBlock ? 
              `Target: ${targetBlock.x}, ${targetBlock.y}, ${targetBlock.z}` : 
              'No target block';
          }, 2000);
        }
        
        // Log the selection for debugging
        console.log('Selected block type:', blockName, 'Index:', index);
      } catch (error) {
        console.error('Error accessing block name:', error);
      }
      
      // Make hotbar visible for a few seconds
      const hotbar = document.getElementById('hotbar');
      if (hotbar) {
        hotbar.style.opacity = '1';
        // Fade out after 3 seconds
        setTimeout(() => {
          hotbar.style.opacity = '0.7';
        }, 3000);
      }
    } else {
      console.error(`Index ${index} is out of bounds for blockTypes array (length: ${world.minecraft.blockTypes?.length})`);
    }
  } else {
    console.error('world or world.minecraft not initialized');
  }
}

// Create UI elements for Panda Rescue Quest
function createPandaQuestUI() {
  // Create panda counter
  pandaCounter = document.createElement('div');
  pandaCounter.id = 'pandaCounter';
  pandaCounter.className = 'overlay';
  pandaCounter.style.top = '50px';
  pandaCounter.style.left = '10px';
  pandaCounter.textContent = 'Pandas Found: 0/4';
  document.querySelector('.canvas-container').appendChild(pandaCounter);
  
  // Create win message (initially hidden)
  winMessage = document.createElement('div');
  winMessage.id = 'winMessage';
  winMessage.className = 'overlay';
  winMessage.style.top = '50%';
  winMessage.style.left = '50%';
  winMessage.style.transform = 'translate(-50%, -50%)';
  winMessage.style.padding = '20px';
  winMessage.style.fontSize = '24px';
  winMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  winMessage.style.border = '2px solid white';
  winMessage.style.display = 'none';
  winMessage.textContent = 'You Win! All baby pandas reunited with their parent!';
  document.querySelector('.canvas-container').appendChild(winMessage);
} 