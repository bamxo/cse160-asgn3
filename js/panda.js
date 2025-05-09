// Panda class for creating a panda model in the world
class Panda {
  constructor(x = 0, y = 0, z = 0, scale = 1.0) {
    this.position = [x, y, z];
    this.scale = scale;
    
    // Define colors used across the panda model based on Minecraft reference
    this.whiteColor = [0.95, 0.95, 0.95];     // Pure white for main body
    this.blackColor = [0.08, 0.08, 0.08];     // Pure black for patches and legs
    this.darkGrayColor = [0.3, 0.3, 0.3];     // Dark gray for shading
    this.lightGrayColor = [0.7, 0.7, 0.7];    // Light gray for muzzle area
    this.mediumGrayColor = [0.5, 0.5, 0.5];   // Medium gray for details
    this.pinkColor = [0.95, 0.5, 0.65];       // Pink for tongue
    
    // Initialize facing angle (rotation around Y-axis in degrees)
    // Default to 180 which means facing negative Z direction
    this.facingAngle = 180;
    
    // Animation variables
    this.animations = {
      headRotation: 0,
      legRotation1: 0,
      legRotation2: 0,
      tailRotation: 0,
      isAnimating: false,
      animationTime: 0
    };
    
    // Poke animation variables (from Assignment 2)
    this.isPoking = false;
    this.isFlipped = false;
    this.pokeStartTime = 0;
    this.pokeDuration = 1000; // Animation lasts 1 second for transition
    
    // Buffer cache for performance optimization
    this.bufferCache = {
      initialized: false
    };
  }
  
  // Initialize shared buffers for all cubes
  initBuffers(gl) {
    if (this.bufferCache.initialized) return;
    
    // Create a standard cube for reference
    const cube = new Cube(0, 0, 0, 1.0, [1, 1, 1]);
    
    // Create and store vertex buffer
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cube.vertices, gl.STATIC_DRAW);
    
    // Create and store index buffer
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cube.indices, gl.STATIC_DRAW);
    
    // Create and store normal buffer
    const normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, cube.normals, gl.STATIC_DRAW);
    
    // Store buffers in cache
    this.bufferCache = {
      vertices: vertexBuffer,
      indices: indexBuffer,
      normals: normalBuffer,
      initialized: true
    };
  }
  
  // Set the panda's position
  setPosition(x, y, z) {
    this.position[0] = x;
    this.position[1] = y;
    this.position[2] = z;
    return this;
  }
  
  // Set the panda's scale
  setScale(scale) {
    this.scale = scale;
    return this;
  }
  
  // Toggle the poke animation from Assignment 2
  startPokeAnimation() {
    this.isPoking = true;
    this.pokeStartTime = Date.now();
    // Toggle the flipped state
    this.isFlipped = !this.isFlipped;
  }
  
  // Update animation state
  update(deltaTime, terrain = null) {
    if (this.animations.isAnimating) {
      // Update animation time
      this.animations.animationTime += deltaTime * 0.001; // Convert to seconds
      
      // Animate head
      this.animations.headRotation = Math.sin(this.animations.animationTime * 0.5) * 8;
      
      // Animate legs - make left and right legs move in opposite directions
      // Left legs (front and back)
      this.animations.legRotation1 = Math.sin(this.animations.animationTime * 3.0) * 30;
      
      // Right legs (front and back) - use cosine for opposite motion
      this.animations.legRotation2 = Math.cos(this.animations.animationTime * 3.0) * 30;
    }
    
    // If terrain is provided, adjust panda's height to stay above it
    if (terrain) {
      const x = Math.floor(this.position[0]);
      const z = Math.floor(this.position[2]);
      const terrainHeight = terrain.getHeightAt(x, z);
      
      // Set the panda to be 0.7 units above the terrain
      // This keeps the legs touching the ground based on the panda's model
      this.position[1] = terrainHeight + 0.7;
    }
    
    // Check if poke animation is active
    if (this.isPoking) {
      const currentTime = Date.now();
      const elapsedTime = currentTime - this.pokeStartTime;
      
      if (elapsedTime >= this.pokeDuration) {
        // Animation transition is done, but maintain flipped state
        this.isPoking = false;
      }
    }
  }
  
  // Start animation
  startAnimation() {
    this.animations.isAnimating = true;
    this.animations.animationTime = 0;
  }
  
  // Stop animation
  stopAnimation() {
    this.animations.isAnimating = false;
    this.animations.headRotation = 0;
    this.animations.legRotation1 = 0;
    this.animations.legRotation2 = 0;
  }
  
  // Toggle animation state
  toggleAnimation() {
    if (this.animations.isAnimating) {
      this.stopAnimation();
    } else {
      this.startAnimation();
    }
  }
  
  // Override the renderCube method to ensure proper lighting on all sides
  renderCube(gl, modelMatrix, color, colorLocation, textureWeight, samplerLocation) {
    // Set color uniform
    gl.uniform3fv(colorLocation, color);
    
    // Set texture weight (0 = color only) if provided
    if (textureWeight !== undefined) {
      gl.uniform1f(textureWeight, 0.0);
    }
    
    // Set model matrix uniform
    const u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
    
    // Bind pre-stored vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferCache.vertices);
    const a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);
    
    // Bind pre-stored normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferCache.normals);
    const a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);
    
    // Temporarily disable culling to draw both sides with proper lighting
    gl.disable(gl.CULL_FACE);
    
    // Bind pre-stored index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferCache.indices);
    
    // Draw the cube
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
    
    // Re-enable culling for other objects
    gl.enable(gl.CULL_FACE);
  }
  
  // Helper method to render a single pixel (cube) for the pixelated details
  renderPixel(gl, parentMatrix, x, y, z, size, color, colorLocation, textureWeight, samplerLocation) {
    const pixelMatrix = new Matrix4(parentMatrix);
    pixelMatrix.translate(x, y, z);
    pixelMatrix.scale(size, size, size/3); // Make pixels flatter like in the original
    
    this.renderCube(gl, pixelMatrix, color, colorLocation, textureWeight, samplerLocation);
  }

  // Draw the panda's body
  drawBody(gl, parentMatrix, colorLocation, textureWeight, samplerLocation) {
    // Main body - white - make sure entire body is white
    const bodyMatrix = new Matrix4(parentMatrix);
    bodyMatrix.translate(0, 0.3, 0);
    // Use more accurate Minecraft panda proportions (slightly taller, less wide)
    bodyMatrix.scale(1.2, 1.1, 1.7);
    
    this.renderCube(gl, bodyMatrix, this.whiteColor, colorLocation, textureWeight, samplerLocation);

    // Black left side vertical stripe - slightly protruding from body
    const leftStripeMatrix = new Matrix4(parentMatrix);
    leftStripeMatrix.translate(-0.58, 0.3, 0); 
    leftStripeMatrix.scale(0.15, 1.1, 0.6); // Thinner stripe with less protrusion
    
    this.renderCube(gl, leftStripeMatrix, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Black right side vertical stripe - slightly protruding from body
    const rightStripeMatrix = new Matrix4(parentMatrix);
    rightStripeMatrix.translate(0.58, 0.3, 0);
    rightStripeMatrix.scale(0.15, 1.1, 0.6); // Thinner stripe with less protrusion
    
    this.renderCube(gl, rightStripeMatrix, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Black top horizontal stripe - matching protrusion of side stripes
    const topStripeMatrix = new Matrix4(parentMatrix);
    topStripeMatrix.translate(0, 0.85, 0);
    topStripeMatrix.scale(1.2, 0.15, 0.6); // Increased width to match body width
    
    this.renderCube(gl, topStripeMatrix, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Add subtle black side panels flush with body to prevent z-fighting
    const leftPanelMatrix = new Matrix4(parentMatrix);
    leftPanelMatrix.translate(-0.61, 0.3, 0); 
    leftPanelMatrix.scale(0.01, 1.1, 0.6); // Very thin panel flush with body side
    
    this.renderCube(gl, leftPanelMatrix, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Right side panel
    const rightPanelMatrix = new Matrix4(parentMatrix);
    rightPanelMatrix.translate(0.61, 0.3, 0);
    rightPanelMatrix.scale(0.01, 1.1, 0.6); // Very thin panel flush with body side
    
    this.renderCube(gl, rightPanelMatrix, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Top panel
    const topPanelMatrix = new Matrix4(parentMatrix);
    topPanelMatrix.translate(0, 0.9, 0);
    topPanelMatrix.scale(1.2, 0.01, 0.6); // Increased width to match body width
    
    this.renderCube(gl, topPanelMatrix, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Draw the tail (only in normal state)
    if (this.animations.isAnimating) {
      // Calculate tail angle - gentle wagging motion
      const tailAngle = Math.sin(Date.now() * 0.003) * 20; // 20-degree wag
      this.drawTail(gl, parentMatrix, tailAngle, colorLocation, textureWeight, samplerLocation);
    } else {
      // Static tail
      this.drawTail(gl, parentMatrix, 0, colorLocation, textureWeight, samplerLocation);
    }
  }

  // Helper method to draw tail with animation - fixed to be fully white
  drawTail(gl, parentMatrix, tailRotation, colorLocation, textureWeight, samplerLocation) {
    // Create the tail matrix
    const tailMatrix = new Matrix4(parentMatrix);
    tailMatrix.translate(0, 0.3, -0.85); // Position the tail at the back of the panda
    
    // Apply tail animation rotation around the X axis
    tailMatrix.rotate(tailRotation, 1, 0, 0);
    
    // Move the tail out a bit from the rotation point
    tailMatrix.translate(0, 0, -0.2);
    tailMatrix.scale(0.25, 0.25, 0.25); // Smaller tail to match Minecraft reference
    
    // Ensure the tail is pure white
    this.renderCube(gl, tailMatrix, this.whiteColor, colorLocation, textureWeight, samplerLocation);
  }

  // Draw the panda's head
  drawHead(gl, parentMatrix, colorLocation, headAngle, textureWeight, samplerLocation) {
    // Head - white base with turn animation
    const headMatrix = new Matrix4(parentMatrix);
    headMatrix.translate(0, 0.1, 1.0);
    headMatrix.rotate(headAngle, 0, 1, 0); // Add head turn around Y axis
    headMatrix.scale(1.0, 0.8, 0.8);
    
    this.renderCube(gl, headMatrix, this.whiteColor, colorLocation, textureWeight, samplerLocation);
    
    // ======= LEFT EYE - Pixelated Minecraft style =======
    // Create a matrix for pixel positioning - using a consistent scale for all pixels
    const pixelSize = 0.1; // Size of each "pixel" cube
    const baseZ = 0.51; // Z-position for all pixels (slightly in front of face)
    
    // LEFT EYE BLACK PIXELS - exact pattern from reference image

    // Row 1 (top row)
    this.renderPixel(gl, headMatrix, -0.45, 0.3, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, -0.35, 0.3, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, -0.25, 0.3, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Row 2
    this.renderPixel(gl, headMatrix, -0.45, 0.2, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, -0.35, 0.2, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, -0.25, 0.2, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, -0.15, 0.2, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Row 3
    this.renderPixel(gl, headMatrix, -0.45, 0.1, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, -0.15, 0.1, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Row 4
    this.renderPixel(gl, headMatrix, -0.45, 0.0, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, -0.35, 0.0, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, -0.25, 0.0, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // LEFT EYE GRAY PIXEL - placed at the inner part of the eye (right side)
    this.renderPixel(gl, headMatrix, -0.25, 0.1, baseZ + 0.01, pixelSize, this.mediumGrayColor, colorLocation, textureWeight, samplerLocation);
    
    // LEFT EYE WHITE PIXEL - placed at the outer part of the eye (left side)
    this.renderPixel(gl, headMatrix, -0.35, 0.1, baseZ + 0.01, pixelSize, this.whiteColor, colorLocation, textureWeight, samplerLocation);
    
    // ======= RIGHT EYE - Pixelated Minecraft style =======
    // RIGHT EYE BLACK PIXELS - exact pattern from reference image
    
    // Row 1 (top row)
    this.renderPixel(gl, headMatrix, 0.25, 0.3, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, 0.35, 0.3, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, 0.45, 0.3, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Row 2
    this.renderPixel(gl, headMatrix, 0.15, 0.2, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, 0.25, 0.2, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, 0.35, 0.2, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, 0.45, 0.2, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Row 3
    this.renderPixel(gl, headMatrix, 0.15, 0.1, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, 0.45, 0.1, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Row 4
    this.renderPixel(gl, headMatrix, 0.25, 0.0, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, 0.35, 0.0, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    this.renderPixel(gl, headMatrix, 0.45, 0.0, baseZ, pixelSize, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // RIGHT EYE GRAY PIXEL - placed at the correct spot in the reference image
    this.renderPixel(gl, headMatrix, 0.25, 0.1, baseZ + 0.01, pixelSize, this.mediumGrayColor, colorLocation, textureWeight, samplerLocation);
    
    // RIGHT EYE WHITE PIXEL - placed to the right of the gray pixel
    this.renderPixel(gl, headMatrix, 0.35, 0.1, baseZ + 0.01, pixelSize, this.whiteColor, colorLocation, textureWeight, samplerLocation);
    
    // Ears - static position
    // Left ear
    const leftEarMatrix = new Matrix4(headMatrix);
    leftEarMatrix.translate(-0.5, 0.6, 0.0);
    leftEarMatrix.scale(0.35, 0.45, 0.15);
    
    this.renderCube(gl, leftEarMatrix, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Right ear
    const rightEarMatrix = new Matrix4(headMatrix);
    rightEarMatrix.translate(0.5, 0.6, 0.0);
    rightEarMatrix.scale(0.35, 0.45, 0.15);
    
    this.renderCube(gl, rightEarMatrix, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Muzzle area - white in Minecraft panda
    const muzzleMatrix = new Matrix4(headMatrix);
    muzzleMatrix.translate(0, -0.15, 0.51);
    muzzleMatrix.scale(0.4, 0.2, 0.1);
    
    this.renderCube(gl, muzzleMatrix, this.whiteColor, colorLocation, textureWeight, samplerLocation);
    
    // Black square nose (more prominent)
    const noseMatrix = new Matrix4(headMatrix);
    noseMatrix.translate(0, -0.07, 0.52);
    noseMatrix.scale(0.3, 0.15, 0.1);
    
    this.renderCube(gl, noseMatrix, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Pink tongue underneath (visible beneath the nose) - Minecraft style
    const tongueMatrix = new Matrix4(headMatrix);
    tongueMatrix.translate(0, -0.25, 0.52);
    tongueMatrix.scale(0.2, 0.15, 0.1);
    
    this.renderCube(gl, tongueMatrix, this.pinkColor, colorLocation, textureWeight, samplerLocation);
  }

  // Draw the panda's legs with joint animation
  drawLegs(gl, parentMatrix, colorLocation, jointAngle1, jointAngle2, textureWeight, samplerLocation) {
    // Front legs (black)
    // Left front leg
    const leftFrontLegMatrix = new Matrix4(parentMatrix);
    leftFrontLegMatrix.translate(-0.25, -0.2, 0.6); // Moved closer to center (was -0.3)
    leftFrontLegMatrix.rotate(-jointAngle1 * 0.8, 1, 0, 0); // Quick but less extreme rotation
    leftFrontLegMatrix.translate(0, -0.3, 0); // Offset to keep leg length but change pivot
    leftFrontLegMatrix.scale(0.4, 0.7, 0.4); // Slightly shorter to prevent protrusion
    
    this.renderCube(gl, leftFrontLegMatrix, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Right front leg
    const rightFrontLegMatrix = new Matrix4(parentMatrix);
    rightFrontLegMatrix.translate(0.25, -0.2, 0.6); // Moved closer to center (was 0.3)
    rightFrontLegMatrix.rotate(jointAngle2 * 0.8, 1, 0, 0); // Quick but less extreme rotation
    rightFrontLegMatrix.translate(0, -0.3, 0); // Offset to keep leg length but change pivot
    rightFrontLegMatrix.scale(0.4, 0.7, 0.4); // Slightly shorter to prevent protrusion
    
    this.renderCube(gl, rightFrontLegMatrix, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Back legs (black)
    // Left back leg
    const leftBackLegMatrix = new Matrix4(parentMatrix);
    leftBackLegMatrix.translate(-0.25, -0.2, -0.6); // Moved closer to center (was -0.3)
    leftBackLegMatrix.rotate(jointAngle2 * 0.8, 1, 0, 0); // Quick but less extreme rotation
    leftBackLegMatrix.translate(0, -0.3, 0); // Offset to keep leg length but change pivot
    leftBackLegMatrix.scale(0.4, 0.7, 0.4); // Slightly shorter to prevent protrusion
    
    this.renderCube(gl, leftBackLegMatrix, this.blackColor, colorLocation, textureWeight, samplerLocation);
    
    // Right back leg
    const rightBackLegMatrix = new Matrix4(parentMatrix);
    rightBackLegMatrix.translate(0.25, -0.2, -0.6); // Moved closer to center (was 0.3)
    rightBackLegMatrix.rotate(-jointAngle1 * 0.8, 1, 0, 0); // Quick but less extreme rotation
    rightBackLegMatrix.translate(0, -0.3, 0); // Offset to keep leg length but change pivot
    rightBackLegMatrix.scale(0.4, 0.7, 0.4); // Slightly shorter to prevent protrusion
    
    this.renderCube(gl, rightBackLegMatrix, this.blackColor, colorLocation, textureWeight, samplerLocation);
  }

  // Draw the panda in flipped position
  drawFlippedPanda(gl, parentMatrix, colorLocation, headAngle, jointAngle1, jointAngle2, textureWeight, samplerLocation) {
    const pokeMatrix = new Matrix4(parentMatrix);
    
    // Position the flipped panda
    pokeMatrix.translate(0, 0.3, 0); // Lift slightly for better visibility
    
    // Add a continuous small rocking animation on X axis when flipped
    const currentTime = Date.now();
    const rockingAngle = Math.sin(currentTime * 0.002) * 10; // Small 10-degree rocking
    
    // First rotate on X axis for the rocking motion, then do the flip on Z axis
    pokeMatrix.rotate(rockingAngle, 1, 0, 0); // Small X-axis rotation
    pokeMatrix.rotate(180, 0, 0, 1); // Full 180 degree rotation (upside down)
    
    // Draw all panda parts in the flipped position
    this.drawBody(gl, pokeMatrix, colorLocation, textureWeight, samplerLocation);
    this.drawHead(gl, pokeMatrix, colorLocation, headAngle, textureWeight, samplerLocation);
    
    // Use the joint angles passed in for walking animation, but modify them for the flipped state
    if (typeof jointAngle1 === 'number' && typeof jointAngle2 === 'number') {
      // When flipped, add a kicking motion to the legs
      // Make the legs move more energetically when upside down
      
      // Use a different frequency for the leg movement when flipped
      const flippedFrequency = 0.004;
      const extraKick = Math.sin(currentTime * flippedFrequency) * 30;
      
      // Apply the extra kick movement to the standard angles
      // Left and right legs move in alternating pattern with extra amplitude
      const leftLegAngle = -jointAngle1 + 90 + extraKick;
      const rightLegAngle = -jointAngle2 + 90 - extraKick;
      
      this.drawLegs(gl, pokeMatrix, colorLocation, leftLegAngle, rightLegAngle, textureWeight, samplerLocation);
    } else {
      // Fallback to static pose if no animation angles provided
      this.drawLegs(gl, pokeMatrix, colorLocation, 90, -90, textureWeight, samplerLocation);
    }
    
    // Add a more energetic tail wag when flipped (faster frequency)
    const flippedTailFrequency = 0.005;
    const flippedTailAngle = Math.sin(currentTime * flippedTailFrequency) * 45; // Larger amplitude
    
    // Draw the tail with its own animation
    this.drawTail(gl, pokeMatrix, flippedTailAngle, colorLocation, textureWeight, samplerLocation);
  }
  
  // Draw the poke animation (panda rolling on its back)
  drawPokeAnimation(gl, parentMatrix, colorLocation, progress, headAngle, textureWeight, samplerLocation) {
    // Create a copy of the parent matrix
    const pokeMatrix = new Matrix4(parentMatrix);
    
    // Simplified animation: just flip the panda upside down
    // progress goes from 0 to 1 (normal to upside down)
    
    // Calculate the flip angle based on progress
    const flipAngle = progress * 180; // Rotate from 0 to 180 degrees
    
    pokeMatrix.translate(0, 0.3, 0); // Lift slightly for better visibility
    pokeMatrix.rotate(flipAngle, 0, 0, 1); // Rotate around z-axis (flip)
    
    // Draw all panda parts in the transitioning position
    this.drawBody(gl, pokeMatrix, colorLocation, textureWeight, samplerLocation);
    this.drawHead(gl, pokeMatrix, colorLocation, headAngle, textureWeight, samplerLocation);
    
    // Calculate leg angles based on flip progress
    const legAngle = progress * 90; // Gradually straighten legs during flip
    this.drawLegs(gl, pokeMatrix, colorLocation, legAngle, legAngle, textureWeight, samplerLocation);
    
    // Animate the tail during transition - make it wag more as the flip progresses
    const tailAngle = Math.sin(Date.now() * 0.003) * (30 + progress * 15); // Increasing amplitude
    
    // Draw the tail with transition animation
    this.drawTail(gl, pokeMatrix, tailAngle, colorLocation, textureWeight, samplerLocation);
  }
  
  // Render the panda model - This matches the interface expected in Assignment 3
  render(gl, modelMatrix, camera, u_ModelMatrix, u_ViewMatrix, u_ProjectionMatrix, u_Color, u_TextureWeight, u_Sampler) {
    // Initialize buffers if not already done
    this.initBuffers(gl);
    
    // Create a transform matrix for the entire panda
    const pandaMatrix = new Matrix4(modelMatrix);
    pandaMatrix.translate(this.position[0], this.position[1], this.position[2]);
    
    // Apply scaling for the entire panda
    pandaMatrix.scale(this.scale, this.scale, this.scale);
    
    // Use facingAngle if defined, otherwise default to 180 degree rotation
    if (this.facingAngle !== undefined) {
      // Apply the facing angle rotation (y-axis)
      pandaMatrix.rotate(this.facingAngle, 0, 1, 0);
    } else {
      // Default rotation to face the negative z direction
      pandaMatrix.rotate(180, 0, 1, 0);
    }
    
    // Check if poke animation is active
    if (this.isPoking) {
      const currentTime = Date.now();
      const elapsedTime = currentTime - this.pokeStartTime;
      
      if (elapsedTime >= this.pokeDuration) {
        // Animation transition is done, but maintain flipped state
        // If flipped, draw in the flipped position
        if (this.isFlipped) {
          this.drawFlippedPanda(gl, pandaMatrix, u_Color, this.animations.headRotation, 
                              this.animations.legRotation1, this.animations.legRotation2,
                              u_TextureWeight, u_Sampler);
          return;
        }
      } else {
        // Calculate animation progress (0 to 1)
        const progress = elapsedTime / this.pokeDuration;
        
        // If we're flipping back to normal
        if (!this.isFlipped) {
          // Reverse the progress to go from flipped to normal
          this.drawPokeAnimation(gl, pandaMatrix, u_Color, 1 - progress, 
                               this.animations.headRotation, u_TextureWeight, u_Sampler);
        } else {
          // Normal flipping animation
          this.drawPokeAnimation(gl, pandaMatrix, u_Color, progress, 
                               this.animations.headRotation, u_TextureWeight, u_Sampler);
        }
        return;
      }
    } else if (this.isFlipped) {
      // Maintain the flipped state even when not animating
      this.drawFlippedPanda(gl, pandaMatrix, u_Color, this.animations.headRotation, 
                          this.animations.legRotation1, this.animations.legRotation2,
                          u_TextureWeight, u_Sampler);
      return;
    }
    
    // Draw the panda's body parts with normal animations
    this.drawBody(gl, pandaMatrix, u_Color, u_TextureWeight, u_Sampler);
    this.drawHead(gl, pandaMatrix, u_Color, this.animations.headRotation, u_TextureWeight, u_Sampler);
    this.drawLegs(gl, pandaMatrix, u_Color, this.animations.legRotation1, this.animations.legRotation2, u_TextureWeight, u_Sampler);
  }
} 