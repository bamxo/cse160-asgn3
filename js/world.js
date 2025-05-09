// World class to manage the 3D world
class World {
  constructor(gl, size = 16) {  // Further reduced from 24 to 16
    this.gl = gl;
    this.size = size;  // World size (16x16)
    this.maxHeight = 2;  // Reduced maximum wall height from 3 to 2
    
    // Initialize world map (0 = no wall, 1-2 = wall height)
    this.map = this.generateMap();
    
    // Objects in the world
    this.skybox = null;
    this.ground = null;
    this.terrain = null; // New terrain object
    this.walls = [];
    this.pandas = [];
    
    // Grass grid plane
    this.grassGrid = null;
    
    // Textures
    this.textures = {};
    this.textureGenerator = new TextureGenerator(gl);
    this.texturesApplied = false;
    
    // Object for adding/removing blocks
    this.minecraft = {
      enabled: true,
      selectedBlock: 1,
      range: 24,  // How far the player can reach to add/remove blocks (increased from 3 to 24)
      selectedBlockTypeIndex: 1, // Default to dirt block
      blockTypes: [
        { name: "Grass", color: [0.4, 0.8, 0.4], textureIndex: 0 },
        { name: "Dirt", color: [0.6, 0.4, 0.2], textureIndex: 1 },
        { name: "Stone", color: [0.7, 0.7, 0.7], textureIndex: 2 },
        { name: "Wood", color: [0.6, 0.4, 0.2], textureIndex: 3 },
        { name: "Leaves", color: [0.0, 0.7, 0.0], textureIndex: 4 },
        { name: "Brick", color: [0.8, 0.4, 0.4], textureIndex: 5 }
      ]
    };
    
    // For instanced rendering
    this.instancedRendering = false;
    this.instanceCount = 0;
    this.instancePositions = null;
    this.instanceBuffer = null;
    this.instancedReady = false;
    
    // Panda Rescue Quest game state
    this.gameState = {
      babyPandas: [],
      totalBabyPandas: 4,
      foundBabyPandas: 0,
      gameWon: false,
      followDistance: 5, // How close player needs to be for pandas to follow
      playerPosition: [0, 0, 0],
      followingSpeed: 0.08, // Increased speed to better keep up with player
      mainPandaReached: false, // Whether all baby pandas have reached the main panda
      followOffset: 3.5, // Distance at which baby pandas follow the player
      playerMovingDirection: [0, 0, 0], // Direction the player is moving (x, y, z)
      lastPlayerPosition: [0, 0, 0], // Last known player position to calculate direction
      minPandaSpeed: 0.03, // Minimum speed even when close to target
      maxPandaSpeed: 0.15,  // Maximum speed when far from target
      previousFormationDirection: [0, 0, -1], // Previous direction of the formation (starts behind player)
      formationTransitionSpeed: 0.02, // Speed of formation transition when changing sides (lower = smoother)
      transitionProgress: 1.0 // Progress of transition (1.0 means complete)
    };
  }
  
  // Generate a 16x16 world map with minimal structures
  generateMap() {
    // Create a 16x16 map with all zeros
    const map = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      map[i] = new Array(this.size).fill(0);
    }
    
    // Define spawn point (center of the world)
    const spawnX = this.size / 2;
    const spawnZ = this.size / 2;
    
    // Define panda location
    const pandaX = Math.floor(this.size / 2) + 2;
    const pandaZ = Math.floor(this.size / 2) + 2;
    
    // Minimum distance from spawn and panda to place trees
    const minDistanceFromSpawn = 5.0;
    const minDistanceFromPanda = 6.0;
    
    // Remove the initial tree placement that was fixed
    // Instead we'll only add trees that meet our distance requirements
    
    // Add trees at random positions on the 64x64 grass floor
    // Place them further from spawn and panda
    const treesToAdd = 20;
    const addedTrees = [];
    
    // Center point of the world (our reference for spawn)
    const centerX = this.size / 2;
    const centerZ = this.size / 2;
    
    // Maximum distance from center to ensure trees are visible on the grass
    // Using 28 instead of 24 to spread trees a bit more across the grass
    const maxDistanceFromCenter = 28;
    
    // Minimum distance between trees (reduced slightly to allow more trees)
    const minDistanceBetweenTrees = 3.5; // Minimum 3.5 blocks apart
    const minDistanceSquared = minDistanceBetweenTrees * minDistanceBetweenTrees;
    
    // Add random trees - make sure they're not too close to existing trees, spawn, or panda
    for (let i = 0; i < treesToAdd; i++) {
      let validPosition = false;
      let newX, newZ;
      
      // Try to find a valid position
      let attempts = 0;
      while (!validPosition && attempts < 100) { // Increased attempts to 100
        // Generate position using a polar coordinate approach for better distribution
        // Use different strategies based on tree index for better distribution
        let angle, distance;
        
        if (i % 3 === 0) {
          // Strategy 1: Fully random distribution
          angle = Math.random() * Math.PI * 2;
          distance = Math.random() * maxDistanceFromCenter;
        } else if (i % 3 === 1) {
          // Strategy 2: Distribute trees in rings with some randomness
          angle = Math.random() * Math.PI * 2;
          // Create rings of trees at different distances
          const ringIndex = Math.floor(Math.random() * 3); // 0, 1, or 2
          const baseDistance = (ringIndex + 1) * (maxDistanceFromCenter / 3);
          distance = baseDistance + (Math.random() * 4 - 2); // Add some variation
        } else {
          // Strategy 3: Create clusters of trees
          // Choose a random existing tree as the cluster center
          if (addedTrees.length > 1) {
            const clusterCenter = addedTrees[Math.floor(Math.random() * addedTrees.length)];
            angle = Math.random() * Math.PI * 2;
            distance = 5 + Math.random() * 3; // 5-8 units from an existing tree
            
            // Calculate position relative to the cluster center
            newX = Math.floor(clusterCenter.x + Math.cos(angle) * distance);
            newZ = Math.floor(clusterCenter.z + Math.sin(angle) * distance);
          } else {
            // Fallback if no trees to cluster around
            angle = Math.random() * Math.PI * 2;
            distance = Math.random() * maxDistanceFromCenter;
            newX = Math.floor(centerX + Math.cos(angle) * distance);
            newZ = Math.floor(centerZ + Math.sin(angle) * distance);
          }
        }
        
        // Skip the calculation if already done by the clustering strategy
        if (i % 3 !== 2 || addedTrees.length <= 1) {
          // Convert to cartesian coordinates, centered around the world center
          newX = Math.floor(centerX + Math.cos(angle) * distance);
          newZ = Math.floor(centerZ + Math.sin(angle) * distance);
        }
        
        // Ensure position is within valid range
        if (newX < 0) newX = 0;
        if (newX >= 64) newX = 63;
        if (newZ < 0) newZ = 0;
        if (newZ >= 64) newZ = 63;
        
        // Check if this position is too close to spawn
        const distFromSpawnSquared = Math.pow(newX - spawnX, 2) + Math.pow(newZ - spawnZ, 2);
        if (distFromSpawnSquared < minDistanceFromSpawn * minDistanceFromSpawn) {
          validPosition = false;
          attempts++;
          continue;
        }
        
        // Check if this position is too close to panda
        const distFromPandaSquared = Math.pow(newX - pandaX, 2) + Math.pow(newZ - pandaZ, 2);
        if (distFromPandaSquared < minDistanceFromPanda * minDistanceFromPanda) {
          validPosition = false;
          attempts++;
          continue;
        }
        
        // Check terrain height at this position - only place trees where terrain exists
        let terrainHeight = 0;
        if (this.terrain) {
          terrainHeight = this.terrain.getHeightAt(newX, newZ);
          // Only allow placement if terrain height is greater than 0.3
          if (terrainHeight < 0.3) {
            validPosition = false;
            attempts++;
            continue;
          }
        }
        
        // Check if this position is too close to any existing tree
        validPosition = true;
        for (const tree of addedTrees) {
          const distSquared = Math.pow(newX - tree.x, 2) + Math.pow(newZ - tree.z, 2);
          if (distSquared < minDistanceSquared) {
            validPosition = false;
            break;
          }
        }
        
        attempts++;
      }
      
      // Add the tree if we found a valid position
      if (validPosition) {
        addedTrees.push({x: newX, z: newZ});
        
        // If the position is within our map boundaries, add it to the map
        if (newX >= 0 && newX < this.size && newZ >= 0 && newZ < this.size) {
          map[newX][newZ] = 10; // Mark as trunk
        } else {
          // For trees outside the map boundaries, we'll handle them separately in init()
          console.log(`Tree outside map: ${newX}, ${newZ}`);
        }
      }
    }
    
    // Store trees outside the map for later use
    this.externalTrees = addedTrees.filter(tree => 
      tree.x < 0 || tree.x >= this.size || tree.z < 0 || tree.z >= this.size);
    
    return map;
  }
  
  // Add a simple border with just corners and some sides
  addSimpleBorder(map) {
    // No borders needed since we're removing all blocks above ground
    // This function is intentionally left empty
  }
  
  // Create pandas and place them around the world
  createPandas() {
    // Define a specific location for the main panda on a flat area
    // Use the center + offset coordinates where we've flattened the terrain
    const pandaX = Math.floor(this.size / 2) + 2;
    const pandaZ = Math.floor(this.size / 2) + 2;
    
    // Get terrain height for panda if terrain exists
    let terrainHeight = 0;
    if (this.terrain) {
      terrainHeight = this.terrain.getHeightAt(pandaX, pandaZ);
      // If terrain height is too low at default location, find a better spot
      if (terrainHeight < 0.3) {
        // Search around for a spot with suitable terrain height
        let found = false;
        let searchRadius = 1;
        const maxSearchRadius = 8;
        
        while (!found && searchRadius <= maxSearchRadius) {
          // Check positions in increasing radius around the initial position
          for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            for (let dz = -searchRadius; dz <= searchRadius; dz++) {
              // Skip if not on the perimeter of the current search radius
              if (Math.abs(dx) < searchRadius && Math.abs(dz) < searchRadius) continue;
              
              const newX = pandaX + dx;
              const newZ = pandaZ + dz;
              
              // Check if in world bounds
              if (newX < 0 || newX >= this.size || newZ < 0 || newZ >= this.size) continue;
              
              const height = this.terrain.getHeightAt(newX, newZ);
              if (height >= 0.3) {
                // Found a good spot
                terrainHeight = height;
                // Update panda position
                pandaX = newX;
                pandaZ = newZ;
                found = true;
                console.log(`Relocated main panda to (${pandaX}, ${terrainHeight}, ${pandaZ})`);
                break;
              }
            }
            if (found) break;
          }
          searchRadius++;
        }
      }
    }
    
    // Create main panda at the calculated position with terrain height
    // Add 0.7 to the terrain height to ensure the panda's legs touch the ground
    const mainPanda = new Panda(pandaX, terrainHeight + 0.7, pandaZ, 1.0);
    mainPanda.isMainPanda = true; // Mark this as the main panda
    
    // Set main panda to face a specific direction (facing into the world)
    mainPanda.facingAngle = 225; // Rotate to face the center of the world
    
    this.pandas.push(mainPanda);
    
    // Start animation for main panda
    mainPanda.startAnimation();
    
    // Create baby pandas and hide them around the terrain near trees
    this.createBabyPandas();
  }
  
  // Create baby pandas for the Panda Rescue Quest game
  createBabyPandas() {
    // Create baby pandas and position them near trees
    const treePositions = this.findTreePositions();
    const babyPandaScale = 0.5; // Half the size of a regular panda
    
    // Filter tree positions to only include those on sufficient terrain height
    const validTreePositions = treePositions.filter(pos => {
      if (!this.terrain) return true;
      const terrainHeight = this.terrain.getHeightAt(pos.x, pos.z);
      return terrainHeight >= 0.3;
    });
    
    console.log(`Found ${validTreePositions.length} valid tree positions for baby pandas (out of ${treePositions.length} total)`);
    
    // If no valid positions, try to find alternative positions
    if (validTreePositions.length === 0 && this.terrain) {
      console.log("No valid tree positions found, searching for alternative positions");
      // Find some terrain high spots for pandas
      for (let x = 0; x < this.size; x++) {
        for (let z = 0; z < this.size; z++) {
          const terrainHeight = this.terrain.getHeightAt(x, z);
          if (terrainHeight >= 0.5) { // Higher threshold for alternative positions
            validTreePositions.push({x, z});
            // Limit to a reasonable number
            if (validTreePositions.length >= 6) break;
          }
        }
        if (validTreePositions.length >= 6) break;
      }
    }
    
    // Use up to 4 tree positions (or less if not enough trees)
    const numBabyPandas = Math.min(this.gameState.totalBabyPandas, validTreePositions.length);
    
    // If not enough trees, adjust the total number of baby pandas
    this.gameState.totalBabyPandas = numBabyPandas;
    
    // Shuffle the tree positions to randomize where baby pandas appear
    this.shuffleArray(validTreePositions);
    
    for (let i = 0; i < numBabyPandas; i++) {
      const pos = validTreePositions[i];
      
      // Get terrain height at this position
      let terrainHeight = 0;
      if (this.terrain) {
        terrainHeight = this.terrain.getHeightAt(pos.x, pos.z);
      }
      
      // Create baby panda at slightly random position near the tree
      const offsetX = Math.random() * 2 - 1; // Random offset between -1 and 1
      const offsetZ = Math.random() * 2 - 1; // Random offset between -1 and 1
      
      // Create baby panda with scaled-down size
      const babyPanda = new Panda(
        pos.x + offsetX, 
        terrainHeight + 0.7 * babyPandaScale, // Adjust height based on scale
        pos.z + offsetZ, 
        babyPandaScale
      );
      
      // Mark as baby panda
      babyPanda.isBabyPanda = true;
      babyPanda.isFollowing = false;
      babyPanda.followOffset = [Math.random() * 2 - 1, 0, Math.random() * 2 - 1]; // Random offset for following
      
      // Start animation for baby pandas
      babyPanda.startAnimation();
      
      // Add to pandas array and game state
      this.pandas.push(babyPanda);
      this.gameState.babyPandas.push(babyPanda);
    }
    
    console.log(`Created ${numBabyPandas} baby pandas for Panda Rescue Quest`);
  }
  
  // Find positions of all trees in the world to place baby pandas
  findTreePositions() {
    const treePositions = [];
    
    // Check all wall blocks for tree trunks (wood blocks)
    for (const wall of this.walls) {
      // If this is a tree trunk (wood texture)
      if (wall.textureType === 'wood') {
        // Only consider the bottom trunk block for each tree
        // Check if this position is not already in our list
        const positionExists = treePositions.some(
          pos => Math.abs(pos.x - wall.position[0]) < 0.1 && 
                 Math.abs(pos.z - wall.position[2]) < 0.1
        );
        
        if (!positionExists) {
          treePositions.push({
            x: wall.position[0],
            z: wall.position[2]
          });
        }
      }
    }
    
    return treePositions;
  }
  
  // Helper function to shuffle an array (Fisher-Yates algorithm)
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  
  // Toggle animation for all pandas
  togglePandaAnimations() {
    for (const panda of this.pandas) {
      panda.toggleAnimation();
    }
  }
  
  // Initialize textures using the texture generator
  initTextures() {
    this.textures = this.textureGenerator.generateAllTextures();
    console.log("Generated textures:", Object.keys(this.textures));
    console.log("Texture index mapping:");
    Object.keys(this.textures).forEach((key, index) => {
      console.log(`${key} (index ${index}): ${this.textures[key]}`);
    });
    return Object.keys(this.textures).length;
  }
  
  // Apply textures to existing objects
  applyTextures() {
    if (this.texturesApplied) return;
    
    // Apply textures only if textures have been loaded
    if (Object.keys(this.textures).length > 0) {
      console.log("Applying textures to objects. Available textures:", Object.keys(this.textures));
      
      // Create direct references to each texture object for easier access
      this.textureObjects = {
        ground: this.textures['ground'],
        grass: this.textures['ground'], // Use ground texture for grass blocks
        dirt: this.textures['dirt'] || this.textures['ground'],
        stone: this.textures['stone'] || this.textures['wall'],
        brick: this.textures['brick'] || this.textures['wall'],
        wall: this.textures['wall'],
        sky: this.textures['sky'],
        wood: this.textures['wood'],
        leaves: this.textures['leaves'],
        minecraft_grass: this.textures['minecraft_grass']
      };
      
      // Define texture unit mapping for block types - corrected mapping
      this.textureUnitMap = {
        "Grass": 0,  // ground texture (texture unit 0)
        "Dirt": 1,   // dirt texture (texture unit 1)
        "Stone": 2,  // stone texture (texture unit 2)
        "Brick": 3,  // brick texture (texture unit 3)
        "Wood": 4,   // wood texture (texture unit 4)
        "Leaves": 6  // leaves texture (texture unit 6)
      };
      
      // Print texture unit map for debugging
      console.log("Texture unit mapping:");
      for (const type in this.textureUnitMap) {
        console.log(`Block type: ${type}, Texture unit: ${this.textureUnitMap[type]}`);
      }
      
      // Enable texture for ground, terrain and skybox
      if (this.ground) this.ground.enableTexture(0); // Use ground texture
      if (this.terrain) this.terrain.enableTexture(0); // Use ground texture for terrain
      if (this.skybox) this.skybox.enableTexture(5); // Use sky texture (unit 5)
      if (this.grassGrid) this.grassGrid.enableTexture(8); // Use minecraft grass texture for grass grid
      
      // Apply textures to walls by directly setting their texture types
      for (const wall of this.walls) {
        if (wall.textureType) {
          if (wall.textureType === 'wood') {
            wall.color = [0.6, 0.4, 0.2]; // Brown color for wood
            wall.enableTexture(4); // Texture unit for wood
          } else if (wall.textureType === 'leaves') {
            wall.color = [0.0, 0.7, 0.0]; // Green color for leaves
            wall.enableTexture(6); // Texture unit for leaves
          } else if (wall.textureType === 'grass') {
            wall.color = [0.4, 0.8, 0.4]; // Green color for grass
            wall.enableTexture(0); // Texture unit for grass
          } else if (wall.textureType === 'dirt') {
            wall.color = [0.6, 0.4, 0.2]; // Brown color for dirt
            wall.enableTexture(1); // Texture unit for dirt
          } else if (wall.textureType === 'stone') {
            wall.color = [0.7, 0.7, 0.7]; // Gray color for stone
            wall.enableTexture(2); // Texture unit for stone
          } else if (wall.textureType === 'brick') {
            wall.color = [0.8, 0.4, 0.4]; // Red color for brick
            wall.enableTexture(3); // Texture unit for brick
          } else {
            wall.enableTexture(0); // Default to wall texture
          }
        }
        
        // If the wall has a blockType, make sure the texture is set correctly
        if (wall.blockType && this.textureUnitMap[wall.blockType]) {
          wall.enableTexture(this.textureUnitMap[wall.blockType]);
        }
      }
      
      this.texturesApplied = true;
    } else {
      console.warn("No textures available to apply");
    }
  }
  
  // Initialize the world by creating objects
  init() {
    // Create skybox
    this.skybox = new Cube(0, 0, 0, 1000, [0.5, 0.8, 1.0]);
    
    // Create terrain instead of flat ground
    this.terrain = new Terrain(this.gl, 64, 64, 1.0, 2.5); // Reduced max height from 5.0 to 2.5
    
    // Keep old ground as invisible (for compatibility)
    this.ground = new Cube(this.size / 2 - 0.5, -0.5, this.size / 2 - 0.5, this.size, [0, 0, 0, 0]);
    this.ground.setSize(this.size);
    this.ground.isTransparent = true; // Mark as transparent for rendering
    
    // Create 64x64 Minecraft grass plane at y = -0.7
    // Center it exactly at the world center for better alignment with trees
    const gridHalfSize = 32; // Half of 64
    const centerX = this.size / 2 - 0.5;
    const centerZ = this.size / 2 - 0.5;
    // Remove the grass grid since we're using terrain now
    //this.grassGrid = new Cube(centerX, -0.7, centerZ, 64, [0.5, 0.8, 0.5]);
    //this.grassGrid.setSize(64);
    // Convert to a plane instead of a cube
    //this.grassGrid.createPlane();
    
    // Initialize buffers for terrain, ground and skybox
    this.terrain.initBuffers(this.gl);
    this.ground.initBuffers(this.gl);
    this.skybox.initBuffers(this.gl);
    //this.grassGrid.initBuffers(this.gl);
    
    // Create walls
    this.walls = [];
    
    // First process trees on the map
    for (let x = 0; x < this.size; x++) {
      for (let z = 0; z < this.size; z++) {
        const height = this.map[x][z];
        if (height > 0) {
          if (height === 10) {
            // Create tree at this position
            this.createTree(x, z);
          } else {
            // Handle regular blocks (shouldn't be any in current implementation)
            for (let y = 0; y < height; y++) {
              // Create a new wall cube
              const cube = new Cube(x, y + 0.5, z, 1.0, [0.8, 0.8, 0.8]);
              cube.textureType = "wall";
              cube.enableTexture(0); // Texture unit 0 for wall/ground
              
              this.walls.push(cube);
              // Initialize buffer immediately
              cube.initBuffers(this.gl);
            }
          }
        }
      }
    }
    
    // Process trees that are outside the map bounds
    for (const tree of this.externalTrees || []) {
      this.createTallTree(tree.x, tree.z);
    }
    
    // Create pandas
    this.createPandas();
    
    console.log(`World initialized with ${this.walls.length} wall blocks`);
    
    // Set up instanced rendering if needed
    if (this.instancedRendering) {
      this.setupInstancedRendering();
    }
  }
  
  // Create a tree based on type
  createTree(x, z) {
    // Choose tree type based on position
    const treeType = (x + z) % 3;
    
    // Get the terrain height at this position if terrain exists
    let terrainHeight = 0;
    if (this.terrain) {
      terrainHeight = this.terrain.getHeightAt(x, z);
      
      // Only create trees on terrain with sufficient height
      if (terrainHeight < 0.3) {
        console.log(`Skipping tree at (${x}, ${z}) due to insufficient terrain height: ${terrainHeight}`);
        return;
      }
    }
    
    if (treeType === 0) {
      this.createStandardTree(x, z, terrainHeight);
    } else if (treeType === 1) {
      this.createTallTree(x, z, terrainHeight);
    } else {
      this.createSmallTree(x, z, terrainHeight);
    }
  }
  
  // Create standard tree (4 blocks high with 3x3x2 leaf canopy)
  createStandardTree(x, z, terrainHeight = 0) {
    // Create tree trunk (lower by 0.7 and add terrain height)
    for (let y = 0; y < 4; y++) {
      // Create trunk block
      const cube = new Cube(x, y + 0.5 - 0.7 + terrainHeight, z, 1.0, [0.6, 0.4, 0.2]);
      
      // Mark as tree block
      cube.isTreeBlock = true;
      cube.textureType = "wood";
      cube.enableTexture(4); // Texture unit 4 for wood
      
      this.walls.push(cube);
      // Initialize buffer immediately
      cube.initBuffers(this.gl);
    }
    
    // Create leaf canopy (3x3x2 area)
    for (let lx = x-1; lx <= x+1; lx++) {
      for (let lz = z-1; lz <= z+1; lz++) {
        // Skip center bottom for more natural shape
        if (lx === x && lz === z) continue;
        
        for (let ly = 4; ly <= 5; ly++) {
          // Create leaf block (lower by 0.7 and add terrain height)
          const cube = new Cube(lx, ly + 0.5 - 0.7 + terrainHeight, lz, 1.0, [0.0, 0.7, 0.0]);
          
          // Mark as tree block
          cube.isTreeBlock = true;
          cube.textureType = "leaves";
          cube.enableTexture(6); // Texture unit 6 for leaves
          
          this.walls.push(cube);
          // Initialize buffer immediately
          cube.initBuffers(this.gl);
        }
      }
    }
  }
  
  // Create a tall tree (5-6 blocks high with 5x5x2 leaf canopy)
  createTallTree(x, z, terrainHeight = 0) {
    // Random height between 5-6 blocks
    const height = 5 + Math.floor(Math.random() * 2);
    
    // Create tree trunk and lower by 0.7 plus terrain height
    for (let y = 0; y < height; y++) {
      // Create trunk block with vertical position lowered by 0.7 and terrain height added
      const cube = new Cube(x, y + 0.5 - 0.7 + terrainHeight, z, 1.0, [0.6, 0.4, 0.2]);
      
      // Mark as tree block
      cube.isTreeBlock = true;
      cube.textureType = "wood";
      cube.enableTexture(4); // Texture unit 4 for wood
      
      this.walls.push(cube);
      // Initialize buffer immediately
      cube.initBuffers(this.gl);
    }
    
    // Create larger leaf canopy (5x5x2 area) and lower by 0.7 plus terrain height
    for (let lx = x-2; lx <= x+2; lx++) {
      for (let lz = z-2; lz <= z+2; lz++) {
        // Skip the corners for a more rounded canopy
        if ((lx === x-2 || lx === x+2) && (lz === z-2 || lz === z+2)) {
          // Skip some corners randomly for a more natural look
          if (Math.random() < 0.7) continue;
        }
        
        for (let ly = height; ly <= height+1; ly++) {
          // Create leaf block with vertical position lowered by 0.7 and terrain height added
          const cube = new Cube(lx, ly + 0.5 - 0.7 + terrainHeight, lz, 1.0, [0.0, 0.7, 0.0]);
          
          // Mark as tree block
          cube.isTreeBlock = true;
          cube.textureType = "leaves";
          cube.enableTexture(6); // Texture unit 6 for leaves
          
          this.walls.push(cube);
          // Initialize buffer immediately
          cube.initBuffers(this.gl);
        }
      }
    }
  }
  
  // Create a small tree (3 blocks high with 3x3x1 leaf canopy)
  createSmallTree(x, z, terrainHeight = 0) {
    // Create tree trunk and lower by 0.7 plus terrain height
    for (let y = 0; y < 3; y++) {
      // Create trunk block
      const cube = new Cube(x, y + 0.5 - 0.7 + terrainHeight, z, 1.0, [0.6, 0.4, 0.2]);
      
      // Mark as tree block
      cube.isTreeBlock = true;
      cube.textureType = "wood";
      cube.enableTexture(4); // Texture unit 4 for wood
      
      this.walls.push(cube);
      // Initialize buffer immediately
      cube.initBuffers(this.gl);
    }
    
    // Create small leaf canopy (3x3x1 area)
    for (let lx = x-1; lx <= x+1; lx++) {
      for (let lz = z-1; lz <= z+1; lz++) {
        // Create leaf block with vertical position lowered by 0.7 and terrain height added
        const cube = new Cube(lx, 3 + 0.5 - 0.7 + terrainHeight, lz, 1.0, [0.0, 0.7, 0.0]);
        
        // Mark as tree block
        cube.isTreeBlock = true;
        cube.textureType = "leaves";
        cube.enableTexture(6); // Texture unit 6 for leaves
        
        this.walls.push(cube);
        // Initialize buffer immediately
        cube.initBuffers(this.gl);
      }
    }
  }
  
  // Add a block at the specified position
  addBlock(x, y, z, height = 1, terrainHeight) {
    // For terrain placement outside the regular world bounds
    if (y === -2 && terrainHeight !== undefined) {
      // Check if the position is outside the regular world map but still within the terrain
      const terrainSize = 64; // Terrain is 64x64
      const isOutsideWorldMap = x < 0 || x >= this.size || z < 0 || z >= this.size;
      const isWithinTerrain = x >= 0 && x < terrainSize && z >= 0 && z < terrainSize;
      
      if (isOutsideWorldMap && isWithinTerrain) {
        // Create the block at the terrain height
        const cube = new Cube(x, terrainHeight + 0.5, z, 1.0, [0.8, 0.8, 0.8]);
        
        // Get the currently selected block type
        const selectedBlockIndex = this.minecraft.selectedBlockTypeIndex || 0;
        const selectedBlock = this.minecraft.blockTypes[selectedBlockIndex];
        
        // Add block type property for identification
        cube.blockType = selectedBlock.name;
        
        // Set the block properties based on selected type
        if (selectedBlock) {
          if (selectedBlock.name === "Wood") {
            cube.textureType = "wood";
            cube.enableTexture(4); // Wood texture
            cube.color = [0.6, 0.4, 0.2]; // Wood color
          } else if (selectedBlock.name === "Leaves") {
            cube.textureType = "leaves";
            cube.enableTexture(6); // Leaves texture
            cube.color = [0.0, 0.7, 0.0]; // Leaves color
          } else if (selectedBlock.name === "Grass") {
            cube.textureType = "grass";
            cube.enableTexture(0); // Grass texture
            cube.color = [0.4, 0.8, 0.4]; // Grass color
          } else if (selectedBlock.name === "Dirt") {
            cube.textureType = "dirt";
            cube.enableTexture(1); // Dirt texture
            cube.color = [0.6, 0.4, 0.2]; // Dirt color
          } else if (selectedBlock.name === "Stone") {
            cube.textureType = "stone";
            cube.enableTexture(2); // Stone texture
            cube.color = [0.7, 0.7, 0.7]; // Stone color
          } else if (selectedBlock.name === "Brick") {
            cube.textureType = "brick";
            cube.enableTexture(3); // Brick texture
            cube.color = [0.8, 0.4, 0.4]; // Brick color
          } else {
            // Apply texture if available 
            if (Object.keys(this.textures).length > 0) {
              cube.enableTexture(selectedBlock.textureIndex || 0);
            }
          }
        }
        
        this.walls.push(cube);
        cube.initBuffers(this.gl);
        
        return true;
      }
    }
    
    // For regular positions within world bounds
    if (x < 0 || x >= this.size || z < 0 || z >= this.size) return false;
    
    // Get the currently selected block type
    const selectedBlockIndex = this.minecraft.selectedBlockTypeIndex || 0;
    const selectedBlock = this.minecraft.blockTypes[selectedBlockIndex];
    
    console.log(`Adding block of type: ${selectedBlock.name} (index: ${selectedBlockIndex})`);
    
    // Special case for terrain placement (y = -2, new special value)
    if (y === -2 && terrainHeight !== undefined) {
      // If there's already a block at this position, increment the height instead of setting to 1
      if (this.map[x][z] === 0) {
        this.map[x][z] = 1; // Set height to 1 for new blocks
      } else {
        this.map[x][z] += 1; // Increment height for existing blocks
      }
      
      // Create the block using the actual terrain height plus current map height - 1
      // This places the new block on top of existing blocks
      const blockY = terrainHeight + (this.map[x][z] - 1);
      const cube = new Cube(x, blockY + 0.5, z, 1.0, selectedBlock.color || [0.8, 0.8, 0.8]);
      
      // Add block type property for identification
      cube.blockType = selectedBlock.name;
      
      // Set the block properties based on selected type
      if (selectedBlock) {
        if (selectedBlock.name === "Wood") {
          cube.textureType = "wood";
          cube.enableTexture(4); // Wood texture
        } else if (selectedBlock.name === "Leaves") {
          cube.textureType = "leaves";
          cube.enableTexture(6); // Leaves texture
        } else if (selectedBlock.name === "Grass") {
          cube.textureType = "grass";
          cube.enableTexture(0); // Grass texture
        } else if (selectedBlock.name === "Dirt") {
          cube.textureType = "dirt";
          cube.enableTexture(1); // Dirt texture
        } else if (selectedBlock.name === "Stone") {
          cube.textureType = "stone";
          cube.enableTexture(2); // Stone texture
        } else if (selectedBlock.name === "Brick") {
          cube.textureType = "brick";
          cube.enableTexture(3); // Brick texture
        } else {
          // Apply texture if available (default to texture index based on selected block)
          if (Object.keys(this.textures).length > 0) {
            cube.enableTexture(selectedBlock.textureIndex || 0);
          }
        }
      }
      
      this.walls.push(cube);
      cube.initBuffers(this.gl);
      
      return true;
    }
    
    // Special case for floor placement (y = -1 or 0)
    if (y === -1 || (y === 0 && this.map[x][z] === 0)) {
      this.map[x][z] = 1; // Set height to 1
      
      // Create the block
      const cube = new Cube(x, 0.5, z, 1.0, selectedBlock.color || [0.8, 0.8, 0.8]);
      
      // Add block type property for identification
      cube.blockType = selectedBlock.name;
      
      // Set the block properties based on selected type
      if (selectedBlock) {
        if (selectedBlock.name === "Wood") {
          cube.textureType = "wood";
          cube.enableTexture(4); // Wood texture
        } else if (selectedBlock.name === "Leaves") {
          cube.textureType = "leaves";
          cube.enableTexture(6); // Leaves texture
        } else if (selectedBlock.name === "Grass") {
          cube.textureType = "grass";
          cube.enableTexture(0); // Grass texture
        } else if (selectedBlock.name === "Dirt") {
          cube.textureType = "dirt";
          cube.enableTexture(1); // Dirt texture
        } else if (selectedBlock.name === "Stone") {
          cube.textureType = "stone";
          cube.enableTexture(2); // Stone texture
        } else if (selectedBlock.name === "Brick") {
          cube.textureType = "brick";
          cube.enableTexture(3); // Brick texture
        } else {
          // Apply texture if available (default to texture index based on selected block)
          if (Object.keys(this.textures).length > 0) {
            cube.enableTexture(selectedBlock.textureIndex || 0);
          }
        }
      }
      
      this.walls.push(cube);
      cube.initBuffers(this.gl);
      
      return true;
    }
    
    // Regular block placement
    if (this.map[x][z] < this.maxHeight) {
      this.map[x][z] += height;
      
      // Add new wall cube
      for (let y2 = this.map[x][z] - height; y2 < this.map[x][z]; y2++) {
        // Create the cube with the selected block color
        const cube = new Cube(x, y2 + 0.5, z, 1.0, selectedBlock.color || [0.8, 0.8, 0.8]);
        
        // Add block type property for identification
        cube.blockType = selectedBlock.name;
        
        // Set the block properties based on selected type
        if (selectedBlock) {
          if (selectedBlock.name === "Wood") {
            cube.textureType = "wood";
            cube.enableTexture(4); // Wood texture
          } else if (selectedBlock.name === "Leaves") {
            cube.textureType = "leaves";
            cube.enableTexture(6); // Leaves texture
          } else if (selectedBlock.name === "Grass") {
            cube.textureType = "grass";
            cube.enableTexture(0); // Grass texture
          } else if (selectedBlock.name === "Dirt") {
            cube.textureType = "dirt";
            cube.enableTexture(1); // Dirt texture
          } else if (selectedBlock.name === "Stone") {
            cube.textureType = "stone";
            cube.enableTexture(2); // Stone texture
          } else if (selectedBlock.name === "Brick") {
            cube.textureType = "brick";
            cube.enableTexture(3); // Brick texture
          } else {
            // Apply texture if available (default to texture index based on selected block)
            if (Object.keys(this.textures).length > 0) {
              cube.enableTexture(selectedBlock.textureIndex || 0);
            }
          }
        }
        
        this.walls.push(cube);
        cube.initBuffers(this.gl);
      }
      
      return true;
    }
    
    return false;
  }
  
  // Remove a block at the specified position
  removeBlock(x, y, z) {
    // Special handling for tree blocks and blocks outside regular map (they are not tracked in the map)
    for (let i = this.walls.length - 1; i >= 0; i--) {
      const wall = this.walls[i];
      
      // If this is a tree block or a block outside the regular map bounds, and it matches the position
      if ((wall.isTreeBlock || 
           x < 0 || x >= this.size || z < 0 || z >= this.size) && 
          Math.abs(wall.position[0] - x) < 0.5 && 
          Math.abs(wall.position[1] - y) < 0.5 && 
          Math.abs(wall.position[2] - z) < 0.5) {
        
        // Remove the block
        this.walls.splice(i, 1);
        return true;
      }
    }
    
    // Regular block removal (using map) for blocks within world bounds
    if (x < 0 || x >= this.size || z < 0 || z >= this.size) return false;
    
    // Check if there's a block to remove
    if (this.map[x][z] > 0) {
      // Update map
      this.map[x][z]--;
      
      // Remove wall cube (find and remove the highest cube at this position)
      for (let i = this.walls.length - 1; i >= 0; i--) {
        const wall = this.walls[i];
        
        // More forgiving position check
        if (Math.abs(wall.position[0] - x) < 0.5 && 
            Math.abs(wall.position[2] - z) < 0.5 &&
            Math.abs(wall.position[1] - (this.map[x][z] + 0.5)) < 0.5) {
          
          this.walls.splice(i, 1);
          return true;
        }
      }
    }
    
    return false;
  }
  
  // Find the block in front of the camera for minecraft-style interaction
  findTargetBlock(camera) {
    if (!this.minecraft.enabled) return null;
    
    // Get camera position and direction
    const pos = camera.eye;
    const dir = new Vector3();
    dir.elements[0] = camera.at.elements[0] - camera.eye.elements[0];
    dir.elements[1] = camera.at.elements[1] - camera.eye.elements[1];
    dir.elements[2] = camera.at.elements[2] - camera.eye.elements[2];
    dir.normalize();
    
    // Raycast from camera position
    const maxDistance = this.minecraft.range;
    const step = 0.05; // Reduced step size for more precision (from 0.1 to 0.05)
    let distance = 0;
    
    // Check for tree blocks first (they're more precisely defined)
    while (distance < maxDistance) {
      // Move along the ray
      distance += step;
      
      // Calculate current position along ray
      const x = pos.elements[0] + dir.elements[0] * distance;
      const y = pos.elements[1] + dir.elements[1] * distance;
      const z = pos.elements[2] + dir.elements[2] * distance;
      
      // Check for tree blocks (more precise hit detection)
      for (let i = 0; i < this.walls.length; i++) {
        const wall = this.walls[i];
        
        // Check if wall is a tree block
        if (wall.isTreeBlock) {
          // Calculate distance to tree block center
          const dx = wall.position[0] - x;
          const dy = wall.position[1] - y;
          const dz = wall.position[2] - z;
          const distToTree = Math.sqrt(dx*dx + dy*dy + dz*dz);
          
          // More forgiving distance check for tree blocks (0.6 instead of 0.5)
          if (distToTree < 0.6) {
            return {
              x: Math.floor(wall.position[0]),
              y: Math.floor(wall.position[1]),
              z: Math.floor(wall.position[2]),
              distance: distance,
              isTreeBlock: true
            };
          }
        }
      }
      
      // Check if we hit a regular block
      const blockX = Math.floor(x);
      const blockY = Math.floor(y);
      const blockZ = Math.floor(z);
      
      // Make sure we're within bounds
      if (blockX >= 0 && blockX < this.size && 
          blockZ >= 0 && blockZ < this.size) {
        
        // Check if there's a wall at this position
        const wallHeight = this.map[blockX][blockZ];
        if (wallHeight > 0 && blockY < wallHeight) {
          // We hit a block!
          return {
            x: blockX,
            y: blockY,
            z: blockZ,
            distance: distance
          };
        }
      }
    }
    
    // Special case for terrain - check if looking at terrain surface
    // This is a more advanced ray-terrain intersection
    if (this.terrain && dir.elements[1] < 0.9) { // Not looking straight up
      // Perform terrain ray intersection test
      for (let testDist = 0.1; testDist < maxDistance; testDist += 0.1) {
        const testX = pos.elements[0] + dir.elements[0] * testDist;
        const testY = pos.elements[1] + dir.elements[1] * testDist;
        const testZ = pos.elements[2] + dir.elements[2] * testDist;
        
        // Get the terrain height at this XZ position
        const terrainX = Math.floor(testX);
        const terrainZ = Math.floor(testZ);
        
        // Make sure terrain coordinates are in bounds of the terrain (which is 64x64)
        // Note: The world size is 16x16 but the terrain extends beyond that
        const terrainSize = 64; // Terrain is 64x64
        if (terrainX >= 0 && terrainX < terrainSize && terrainZ >= 0 && terrainZ < terrainSize) {
          const terrainHeight = this.terrain.getHeightAt(testX, testZ);
          
          // Check if the ray passed through the terrain surface
          // We do this by checking if the current test Y is below terrain height
          // but the previous test point was above
          if (testY <= terrainHeight && testY > terrainHeight - 0.3) {
            // Return terrain placement position without checking if there's already a block
            return {
              x: terrainX,
              y: -2, // Special marker for terrain placement
              z: terrainZ,
              terrainHeight: terrainHeight, // Pass the actual terrain height
              distance: testDist,
              isTerrain: true
            };
          }
        }
      }
    }
    
    // Special case for floor - check if looking downward at floor (y=0 plane)
    if (dir.elements[1] < -0.2) { // If looking downward
      // Calculate where ray intersects y=0 plane
      const t = -pos.elements[1] / dir.elements[1];
      
      // If intersection is within range
      if (t > 0 && t < maxDistance) {
        const floorX = Math.floor(pos.elements[0] + dir.elements[0] * t);
        const floorZ = Math.floor(pos.elements[2] + dir.elements[2] * t);
        
        // Check if this floor position is within world bounds
        if (floorX >= 0 && floorX < this.size && 
            floorZ >= 0 && floorZ < this.size) {
          
          // Only return floor hit if no wall already exists there
          if (this.map[floorX][floorZ] === 0) {
            return {
              x: floorX,
              y: -1, // Special indicator for floor
              z: floorZ,
              distance: t,
              isFloor: true
            };
          }
        }
      }
    }
    
    return null;
  }
  
  // Check if a panda is in front of the camera
  findTargetPanda(camera) {
    // Get camera position and direction
    const pos = camera.eye;
    const dir = new Vector3();
    dir.elements[0] = camera.at.elements[0] - camera.eye.elements[0];
    dir.elements[1] = camera.at.elements[1] - camera.eye.elements[1];
    dir.elements[2] = camera.at.elements[2] - camera.eye.elements[2];
    dir.normalize();
    
    // Distance to check
    const maxDistance = 5.0;
    
    // Check each panda
    for (let i = 0; i < this.pandas.length; i++) {
      const panda = this.pandas[i];
      
      // Calculate vector from camera to panda
      const toPanda = new Vector3([
        panda.position[0] - pos.elements[0],
        panda.position[1] - pos.elements[1],
        panda.position[2] - pos.elements[2]
      ]);
      
      // Calculate distance to panda
      const distance = Math.sqrt(
        toPanda.elements[0] * toPanda.elements[0] +
        toPanda.elements[1] * toPanda.elements[1] +
        toPanda.elements[2] * toPanda.elements[2]
      );
      
      // Check if panda is in range
      if (distance > maxDistance) continue;
      
      // Calculate dot product to see if panda is in front of camera
      const normalized = new Vector3(toPanda);
      normalized.normalize();
      const dotProduct = dir.elements[0] * normalized.elements[0] +
                         dir.elements[1] * normalized.elements[1] +
                         dir.elements[2] * normalized.elements[2];
      
      // If dot product is positive (angle less than 90 degrees), panda is in front
      if (dotProduct > 0.7) {
        return {
          panda: panda,
          index: i,
          distance: distance
        };
      }
    }
    
    return null;
  }
  
  // Update world state
  update(deltaTime) {
    // Update all pandas
    for (const panda of this.pandas) {
      panda.update(deltaTime, this.terrain);
    }
    
    // Update Panda Rescue Quest game logic
    this.updateGameLogic(deltaTime);
  }
  
  // Update game logic for Panda Rescue Quest
  updateGameLogic(deltaTime) {
    // Skip if game is already won
    if (this.gameState.gameWon) return;
    
    // Find main panda
    const mainPanda = this.pandas.find(panda => panda.isMainPanda);
    
    // Calculate positions for formation
    this.calculateFormationPositions();
    
    // Check each baby panda
    for (const babyPanda of this.gameState.babyPandas) {
      // Skip if already following
      if (babyPanda.isFollowing) {
        // If following, make it follow according to its formation position
        if (babyPanda.formationPosition) {
          const targetX = babyPanda.formationPosition[0];
          const targetZ = babyPanda.formationPosition[2];
          
          // Calculate distance to target position
          const dx = targetX - babyPanda.position[0];
          const dz = targetZ - babyPanda.position[2];
          const distanceToTarget = Math.sqrt(dx * dx + dz * dz);
          
          // Only move if not too close to target
          if (distanceToTarget > 0.5) {
            // Calculate target rotation angle to face movement direction
            const targetAngle = Math.atan2(dx, dz) * 180 / Math.PI;
            
            // If panda doesn't have a current angle, initialize it
            if (babyPanda.facingAngle === undefined) {
              babyPanda.facingAngle = targetAngle;
            } else {
              // Smooth rotation using interpolation
              // Calculate the shortest angle difference (handling the 360-degree wrap)
              let angleDiff = targetAngle - babyPanda.facingAngle;
              
              // Normalize angle difference to range [-180, 180]
              while (angleDiff > 180) angleDiff -= 360;
              while (angleDiff < -180) angleDiff += 360;
              
              // Apply smooth rotation (faster during transitions)
              const rotationSpeed = this.gameState.transitionProgress < 1.0 ? 0.2 : 0.1;
              babyPanda.facingAngle += angleDiff * rotationSpeed;
              
              // Normalize the resulting angle to range [0, 360]
              while (babyPanda.facingAngle > 360) babyPanda.facingAngle -= 360;
              while (babyPanda.facingAngle < 0) babyPanda.facingAngle += 360;
            }
            
            // Calculate movement speed based on distance to target
            // Speed increases with distance, but is clamped between min and max values
            // This ensures pandas keep up when far away but move smoothly when close
            let speedFactor = Math.min(distanceToTarget * 0.05, 1.0);
            
            // Increase speed during transitions for smoother movement
            if (this.gameState.transitionProgress < 1.0) {
              // Boost speed during transition to make it smoother
              speedFactor = Math.min(speedFactor * 1.5, 1.0);
            }
            
            const moveSpeed = this.gameState.minPandaSpeed + 
                             (this.gameState.maxPandaSpeed - this.gameState.minPandaSpeed) * speedFactor;
            
            // Move toward target position
            babyPanda.position[0] += dx * moveSpeed;
            babyPanda.position[2] += dz * moveSpeed;
            
            // Update terrain height at new position
            if (this.terrain) {
              const terrainHeight = this.terrain.getHeightAt(
                Math.floor(babyPanda.position[0]),
                Math.floor(babyPanda.position[2])
              );
              babyPanda.position[1] = terrainHeight + 0.7 * babyPanda.scale;
            }
          }
        }
        
        // Check if all baby pandas have reached the main panda
        if (mainPanda) {
          const dxToMain = mainPanda.position[0] - babyPanda.position[0];
          const dzToMain = mainPanda.position[2] - babyPanda.position[2];
          const distanceToMain = Math.sqrt(dxToMain * dxToMain + dzToMain * dzToMain);
          
          // If baby pandas are close to main panda, consider game won
          if (distanceToMain < 3.0) {
            babyPanda.mainPandaReached = true;
            
            // Make baby pandas face the main panda when they reach it
            const rotationToMain = Math.atan2(dxToMain, dzToMain) * 180 / Math.PI;
            babyPanda.facingAngle = rotationToMain;
          } else {
            babyPanda.mainPandaReached = false;
          }
        }
      } else {
        // Check if player is close enough to trigger following
        const dx = this.gameState.playerPosition[0] - babyPanda.position[0];
        const dz = this.gameState.playerPosition[2] - babyPanda.position[2];
        const distanceToPlayer = Math.sqrt(dx * dx + dz * dz);
        
        // If player is close enough, make baby panda follow
        if (distanceToPlayer < this.gameState.followDistance) {
          babyPanda.isFollowing = true;
          babyPanda.startAnimation(); // Ensure animation is running
          this.gameState.foundBabyPandas++;
          
          // Calculate initial rotation to face player
          const rotationToPlayer = Math.atan2(dx, dz) * 180 / Math.PI;
          babyPanda.facingAngle = rotationToPlayer;
          
          // Assign formation index
          babyPanda.formationIndex = this.getNextFormationIndex();
        }
      }
    }
    
    // Check if game win condition is met
    this.checkGameWinCondition();
  }
  
  // Assign the next available formation index
  getNextFormationIndex() {
    // Find the next available index
    const usedIndices = this.gameState.babyPandas
      .filter(panda => panda.isFollowing && panda.formationIndex !== undefined)
      .map(panda => panda.formationIndex);
    
    // Find the smallest unused index
    for (let i = 0; i < this.gameState.totalBabyPandas; i++) {
      if (!usedIndices.includes(i)) {
        return i;
      }
    }
    
    // Fallback
    return usedIndices.length;
  }
  
  // Calculate positions for the formation based on player movement
  calculateFormationPositions() {
    // Get player position and direction
    const playerPos = this.gameState.playerPosition;
    const playerDir = this.gameState.playerMovingDirection;
    
    // Base follow distance
    const followDist = this.gameState.followOffset;
    
    // Determine main movement direction
    const movingForward = playerDir[2] > 0.1;  // +Z direction
    const movingBackward = playerDir[2] < -0.1; // -Z direction
    const movingRight = playerDir[0] > 0.1;    // +X direction
    const movingLeft = playerDir[0] < -0.1;    // -X direction
    
    // Create formation direction vectors
    let targetFollowDirectionVector = [0, 0, 0]; // Direction from player to formation center
    let targetFormationLineVector = [0, 0, 0];  // Direction along which pandas line up
    
    // Set these vectors based on movement direction
    if (movingForward) {
      // Moving forward: pandas behind player (-Z), lined up along X axis
      targetFollowDirectionVector = [0, 0, -1];
      targetFormationLineVector = [1, 0, 0];
    } else if (movingBackward) {
      // Moving backward: pandas in front of player (+Z), lined up along X axis
      targetFollowDirectionVector = [0, 0, 1];
      targetFormationLineVector = [1, 0, 0];
    } else if (movingRight) {
      // Moving right: pandas on left side (-X), lined up along Z axis
      targetFollowDirectionVector = [-1, 0, 0];
      targetFormationLineVector = [0, 0, 1];
    } else if (movingLeft) {
      // Moving left: pandas on right side (+X), lined up along Z axis
      targetFollowDirectionVector = [1, 0, 0];
      targetFormationLineVector = [0, 0, 1];
    } else {
      // If not moving, default to behind player and lined up along X axis
      targetFollowDirectionVector = [0, 0, -1];
      targetFormationLineVector = [1, 0, 0];
    }
    
    // Check if the formation direction has changed
    const currentDir = this.gameState.previousFormationDirection;
    const targetDir = targetFollowDirectionVector;
    
    // If direction is different and transition is complete, start a new transition
    if ((currentDir[0] !== targetDir[0] || currentDir[1] !== targetDir[1] || currentDir[2] !== targetDir[2]) && 
        this.gameState.transitionProgress >= 1.0) {
      this.gameState.transitionProgress = 0.0;
    }
    
    // Update transition progress
    if (this.gameState.transitionProgress < 1.0) {
      this.gameState.transitionProgress += this.gameState.formationTransitionSpeed;
      if (this.gameState.transitionProgress > 1.0) {
        this.gameState.transitionProgress = 1.0;
        // Once transition is complete, update the previous direction
        this.gameState.previousFormationDirection = [...targetFollowDirectionVector];
      }
    }
    
    // Calculate the current interpolated formation direction
    const progress = this.gameState.transitionProgress;
    
    // Use easing function to make transitions smoother
    // Apply an ease-in-out curve instead of linear interpolation
    const easedProgress = progress < 0.5 
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    // Smoothly interpolate between previous and target directions
    const followDirectionVector = [
      currentDir[0] * (1 - easedProgress) + targetDir[0] * easedProgress,
      currentDir[1] * (1 - easedProgress) + targetDir[1] * easedProgress,
      currentDir[2] * (1 - easedProgress) + targetDir[2] * easedProgress
    ];
    
    // Use normalized direction to ensure consistent distance
    const dirLength = Math.sqrt(
      followDirectionVector[0] * followDirectionVector[0] + 
      followDirectionVector[1] * followDirectionVector[1] + 
      followDirectionVector[2] * followDirectionVector[2]
    );
    
    if (dirLength > 0) {
      followDirectionVector[0] /= dirLength;
      followDirectionVector[1] /= dirLength;
      followDirectionVector[2] /= dirLength;
    }
    
    // Interpolate formation line vector during transition for a smoother curve
    let formationLineVector;
    if (progress < 1.0) {
      // During transition, calculate interpolated formation line vector
      // Find the previous formation line direction based on previous follow direction
      let previousLineVector;
      if (Math.abs(currentDir[0]) > Math.abs(currentDir[2])) {
        // If previous direction was along X axis, line was along Z
        previousLineVector = [0, 0, 1];
      } else {
        // If previous direction was along Z axis, line was along X
        previousLineVector = [1, 0, 0];
      }
      
      // Interpolate between previous and target line vectors
      formationLineVector = [
        previousLineVector[0] * (1 - easedProgress) + targetFormationLineVector[0] * easedProgress,
        previousLineVector[1] * (1 - easedProgress) + targetFormationLineVector[1] * easedProgress,
        previousLineVector[2] * (1 - easedProgress) + targetFormationLineVector[2] * easedProgress
      ];
      
      // Normalize the line vector
      const lineLength = Math.sqrt(
        formationLineVector[0] * formationLineVector[0] + 
        formationLineVector[1] * formationLineVector[1] + 
        formationLineVector[2] * formationLineVector[2]
      );
      
      if (lineLength > 0) {
        formationLineVector[0] /= lineLength;
        formationLineVector[1] /= lineLength;
        formationLineVector[2] /= lineLength;
      }
    } else {
      // When transition is complete, use target formation line vector directly
      formationLineVector = targetFormationLineVector;
    }
    
    // Count how many pandas are following
    const followingCount = this.gameState.babyPandas.filter(p => p.isFollowing).length;
    
    // Update formation positions for all following pandas
    this.gameState.babyPandas.forEach(panda => {
      if (!panda.isFollowing || panda.formationIndex === undefined) return;
      
      // Calculate position in formation based on index
      const spacing = 1.0; // Space between pandas
      
      // For a line formation, calculate position based on index
      // Start from the middle and expand outward
      let lineOffset = 0;
      
      if (followingCount > 1) {
        // Calculate how far from center this panda should be
        const rowPosition = panda.formationIndex - Math.floor(followingCount / 2);
        lineOffset = rowPosition * spacing;
      }
      
      // Calculate formation center position
      const formationCenterX = playerPos[0] + followDirectionVector[0] * followDist;
      const formationCenterZ = playerPos[2] + followDirectionVector[2] * followDist;
      
      // Calculate final position with offset along the formation line
      panda.formationPosition = [
        formationCenterX + formationLineVector[0] * lineOffset,
        playerPos[1],
        formationCenterZ + formationLineVector[2] * lineOffset
      ];
    });
  }
  
  // Check if all baby pandas have reached the main panda
  checkGameWinCondition() {
    if (this.gameState.foundBabyPandas === this.gameState.totalBabyPandas) {
      const allReachedMain = this.gameState.babyPandas.every(panda => panda.mainPandaReached);
      
      if (allReachedMain) {
        this.gameState.gameWon = true;
        console.log("Game won! All baby pandas reunited with their parent!");
      }
    }
  }
  
  // Set player position for game logic
  setPlayerPosition(x, y, z) {
    // Store the last position before updating
    this.gameState.lastPlayerPosition = [...this.gameState.playerPosition];
    
    // Update current position
    this.gameState.playerPosition = [x, y, z];
    
    // Calculate movement direction vector
    const dx = x - this.gameState.lastPlayerPosition[0];
    const dz = z - this.gameState.lastPlayerPosition[2];
    
    // Only update direction if the player has moved a meaningful distance
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      // Calculate magnitude of movement
      const magnitude = Math.sqrt(dx * dx + dz * dz);
      
      if (magnitude > 0) {
        // Normalize the direction vector
        this.gameState.playerMovingDirection = [dx / magnitude, 0, dz / magnitude];
      }
    }
  }
  
  // Render the world
  render(gl, modelMatrix, camera, u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, u_Color, u_TextureWeight, u_Sampler) {
    // Calculate frustum boundaries for culling
    const viewRange = 24; // Increased from 12 to 24 for better view distance
    const frustumCulling = true; // Set to false to disable culling (for debugging)
    
    // Create a simplified frustum from camera position and view direction
    const camPos = camera.eye;
    const camDir = new Vector3([
      camera.at.elements[0] - camera.eye.elements[0],
      camera.at.elements[1] - camera.eye.elements[1],
      camera.at.elements[2] - camera.eye.elements[2]
    ]);
    camDir.normalize();
    
    // Set view and projection matrices once (avoid repeating)
    gl.uniformMatrix4fv(u_ViewMatrix, false, camera.viewMatrix.elements);
    gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);
    
    // Apply textures if not done already
    if (!this.texturesApplied) {
      this.applyTextures();
    }
    
    // Directly bind all textures to their specific texture units
    if (this.textures && Object.keys(this.textures).length > 0) {
      // Activate texture units and bind textures
      if (this.textures['ground']) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures['ground']);
      }
      
      if (this.textures['dirt'] || this.textures['ground']) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.textures['dirt'] || this.textures['ground']);
      }
      
      if (this.textures['stone'] || this.textures['wall']) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.textures['stone'] || this.textures['wall']);
      }
      
      if (this.textures['brick'] || this.textures['wall']) {
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.textures['brick'] || this.textures['wall']);
      }
      
      if (this.textures['wood']) {
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, this.textures['wood']);
      }
      
      if (this.textures['sky']) {
        gl.activeTexture(gl.TEXTURE5);
        gl.bindTexture(gl.TEXTURE_2D, this.textures['sky']);
      }
      
      if (this.textures['leaves']) {
        gl.activeTexture(gl.TEXTURE6);
        gl.bindTexture(gl.TEXTURE_2D, this.textures['leaves']);
      }
      
      if (this.textures['minecraft_grass']) {
        gl.activeTexture(gl.TEXTURE8);
        gl.bindTexture(gl.TEXTURE_2D, this.textures['minecraft_grass']);
      }
    }
    
    // Create a frustum check function for culling
    const isInFrustum = (position) => {
      if (!frustumCulling) {
        return true; // Skip culling for debugging
      }
      
      // Convert to vector for easier calculations
      const objPos = new Vector3([position[0], position[1], position[2]]);
      
      // Direction from camera to object
      const dirToCam = new Vector3([
        objPos.elements[0] - camPos.elements[0],
        objPos.elements[1] - camPos.elements[1],
        objPos.elements[2] - camPos.elements[2]
      ]);
      
      // Distance to object
      const distToCam = Math.sqrt(
        dirToCam.elements[0] * dirToCam.elements[0] +
        dirToCam.elements[1] * dirToCam.elements[1] +
        dirToCam.elements[2] * dirToCam.elements[2]
      );
      
      // Check if too far for culling
      if (distToCam > viewRange) {
        return false;
      }
      
      // Skip precise angle checking for better performance
      return true;
    };
    
    // First, render the skybox
    this.skybox.render(gl, modelMatrix, camera.viewMatrix, camera.projectionMatrix, 
                     u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, 
                     u_Color, u_TextureWeight, u_Sampler);
    
    // Render the terrain
    if (this.terrain) {
      // Make sure the ground texture is bound
      if (this.textures && this.textures['ground']) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures['ground']);
      }
      
      this.terrain.render(gl, modelMatrix, camera.viewMatrix, camera.projectionMatrix, 
                        u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, 
                        u_Color, u_TextureWeight, u_Sampler);
    }
    
    // Render grass grid (if it exists)
    if (this.grassGrid) {
      // Make sure the minecraft_grass texture is bound
      if (this.textures && this.textures['minecraft_grass']) {
        gl.activeTexture(gl.TEXTURE8);
        gl.bindTexture(gl.TEXTURE_2D, this.textures['minecraft_grass']);
      }
      
      this.grassGrid.render(gl, modelMatrix, camera.viewMatrix, camera.projectionMatrix, 
                          u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, 
                          u_Color, u_TextureWeight, u_Sampler);
    }
    
    // Render walls/blocks with frustum culling
    for (let i = 0; i < this.walls.length; i++) {
      const wall = this.walls[i];
      
      // Skip walls that are not in view frustum
      if (!isInFrustum(wall.position)) {
        continue;
      }
      
      // Set the correct texture for this wall based on block type or texture type
      if (wall.blockType && this.textureUnitMap[wall.blockType]) {
        // Use the mapping to set the correct texture unit
        const textureUnit = this.textureUnitMap[wall.blockType];
        gl.activeTexture(gl.TEXTURE0 + textureUnit);
        // Bind the appropriate texture
        switch (wall.blockType) {
          case "Grass":
            gl.bindTexture(gl.TEXTURE_2D, this.textures['ground']);
            break;
          case "Dirt":
            gl.bindTexture(gl.TEXTURE_2D, this.textures['dirt'] || this.textures['ground']);
            break;
          case "Stone":
            gl.bindTexture(gl.TEXTURE_2D, this.textures['stone'] || this.textures['wall']);
            break;
          case "Brick":
            gl.bindTexture(gl.TEXTURE_2D, this.textures['brick'] || this.textures['wall']);
            break;
          case "Wood":
            gl.bindTexture(gl.TEXTURE_2D, this.textures['wood']);
            break;
          case "Leaves":
            gl.bindTexture(gl.TEXTURE_2D, this.textures['leaves']);
            break;
          default:
            gl.bindTexture(gl.TEXTURE_2D, this.textures['wall']);
        }
      } else if (wall.textureType) {
        // Fall back to textureType if blockType is not available
        if (wall.textureType === 'wood') {
          gl.activeTexture(gl.TEXTURE4);
          gl.bindTexture(gl.TEXTURE_2D, this.textures['wood']);
        } else if (wall.textureType === 'leaves') {
          gl.activeTexture(gl.TEXTURE6);
          gl.bindTexture(gl.TEXTURE_2D, this.textures['leaves']);
        } else if (wall.textureType === 'grass') {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, this.textures['ground']);
        } else if (wall.textureType === 'dirt') {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, this.textures['dirt'] || this.textures['ground']);
        } else if (wall.textureType === 'stone') {
          gl.activeTexture(gl.TEXTURE2);
          gl.bindTexture(gl.TEXTURE_2D, this.textures['stone'] || this.textures['wall']);
        } else if (wall.textureType === 'brick') {
          gl.activeTexture(gl.TEXTURE3);
          gl.bindTexture(gl.TEXTURE_2D, this.textures['brick'] || this.textures['wall']);
        } else {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, this.textures['wall']);
        }
      } else {
        // Default texture binding
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.textures['wall']);
      }
      
      wall.render(gl, modelMatrix, camera.viewMatrix, camera.projectionMatrix, 
                u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, 
                u_Color, u_TextureWeight, u_Sampler);
    }
    
    // Render pandas with frustum culling
    for (let i = 0; i < this.pandas.length; i++) {
      const panda = this.pandas[i];
      
      // Skip pandas that are not in view frustum
      if (!isInFrustum(panda.position)) {
        continue;
      }
      
      panda.render(gl, modelMatrix, camera, 
                           u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix,
                           u_Color, u_TextureWeight, u_Sampler);
    }
    
    // Render transparent objects last (including ground if it's transparent)
    if (this.ground && this.ground.isTransparent) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      
      this.ground.render(gl, modelMatrix, camera.viewMatrix, camera.projectionMatrix, 
                       u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, 
                       u_Color, u_TextureWeight, u_Sampler);
      
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    }
  }
} 