// Camera class for first-person navigation
class Camera {
  constructor(canvas) {
    this.fov = 60;  // Field of view in degrees
    this.eye = new Vector3([0, 1, 5]);  // Camera position (player position)
    this.at = new Vector3([0, 1, 4]);   // Look-at point
    this.up = new Vector3([0, 1, 0]);   // Up vector
    
    // Set up matrices
    this.viewMatrix = new Matrix4();
    this.projectionMatrix = new Matrix4();
    
    // Initialize view matrix
    this.viewMatrix.setLookAt(
      this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
      this.at.elements[0], this.at.elements[1], this.at.elements[2],
      this.up.elements[0], this.up.elements[1], this.up.elements[2]
    );
    
    // Initialize projection matrix
    this.projectionMatrix.setPerspective(this.fov, canvas.width/canvas.height, 0.1, 1000);
    
    // Movement settings
    this.moveSpeed = 0.1;
    this.rotateSpeed = 2;
    
    // Mouse control
    this.mouseEnabled = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.mouseSensitivity = 0.2;
    this.pitch = 0;  // Vertical rotation in degrees
    this.yaw = 0;    // Horizontal rotation in degrees
    this.mouseMovedSinceLastFrame = false; // Track if mouse has moved since last frame
    
    // Height of the camera (player height)
    this.playerHeight = 1.0;
    
    // Reference to the world for terrain height
    this.world = null;
    
    // Movement smoothing
    this.lastTerrainHeight = 0;
    this.isMoving = false;
    this.headBobPhase = 0;
    this.headBobAmount = 0.03; // Subtle head bobbing amount
    this.headBobSpeed = 10;    // Speed of head bobbing
    
    // Add set method to Vector3 prototype if it doesn't exist
    if (!Vector3.prototype.set) {
      Vector3.prototype.set = function(v) {
        if (v.elements) {
          // If v is a Vector3, copy its elements
          this.elements[0] = v.elements[0];
          this.elements[1] = v.elements[1];
          this.elements[2] = v.elements[2];
        } else if (Array.isArray(v)) {
          // If v is an array, copy its elements
          this.elements[0] = v[0];
          this.elements[1] = v[1];
          this.elements[2] = v[2];
        } else {
          // If individual components provided
          this.elements[0] = arguments[0];
          this.elements[1] = arguments[1];
          this.elements[2] = arguments[2];
        }
        return this;
      };
    }
    
    // Add add method to Vector3 prototype if it doesn't exist
    if (!Vector3.prototype.add) {
      Vector3.prototype.add = function(v) {
        if (v.elements) {
          this.elements[0] += v.elements[0];
          this.elements[1] += v.elements[1];
          this.elements[2] += v.elements[2];
        } else if (Array.isArray(v)) {
          this.elements[0] += v[0];
          this.elements[1] += v[1];
          this.elements[2] += v[2];
        } else {
          this.elements[0] += arguments[0];
          this.elements[1] += arguments[1];
          this.elements[2] += arguments[2];
        }
        return this;
      };
    }
    
    // Add sub method to Vector3 prototype if it doesn't exist
    if (!Vector3.prototype.sub) {
      Vector3.prototype.sub = function(v) {
        if (v.elements) {
          this.elements[0] -= v.elements[0];
          this.elements[1] -= v.elements[1];
          this.elements[2] -= v.elements[2];
        } else if (Array.isArray(v)) {
          this.elements[0] -= v[0];
          this.elements[1] -= v[1];
          this.elements[2] -= v[2];
        } else {
          this.elements[0] -= arguments[0];
          this.elements[1] -= arguments[1];
          this.elements[2] -= arguments[2];
        }
        return this;
      };
    }
    
    // Add mul method to Vector3 prototype if it doesn't exist
    if (!Vector3.prototype.mul) {
      Vector3.prototype.mul = function(scalar) {
        this.elements[0] *= scalar;
        this.elements[1] *= scalar;
        this.elements[2] *= scalar;
        return this;
      };
    }
    
    // Add cross product method to Vector3 if it doesn't exist
    if (!Vector3.cross) {
      Vector3.cross = function(v1, v2) {
        const e1 = v1.elements;
        const e2 = v2.elements;
        const result = new Vector3();
        const e = result.elements;
        
        e[0] = e1[1] * e2[2] - e1[2] * e2[1];
        e[1] = e1[2] * e2[0] - e1[0] * e2[2];
        e[2] = e1[0] * e2[1] - e1[1] * e2[0];
        
        return result;
      };
    }
  }
  
  // Set the world reference for terrain height queries
  setWorld(world) {
    this.world = world;
    
    // Initialize lastTerrainHeight to prevent bumpy start
    if (this.world && this.world.terrain) {
      this.lastTerrainHeight = this.world.terrain.getHeightAt(
        this.eye.elements[0], 
        this.eye.elements[2]
      );
    }
  }
  
  // Adjust the camera height based on terrain
  adjustHeightToTerrain() {
    if (!this.world || !this.world.terrain) return;
    
    // Get the terrain height at current position
    const terrainHeight = this.world.terrain.getHeightAt(
      this.eye.elements[0], 
      this.eye.elements[2]
    );
    
    // Keep track of the last terrain height to detect significant changes
    if (Math.abs(terrainHeight - this.lastTerrainHeight) > 0.5) {
      // Gradually adjust to new height to avoid sudden jumps
      this.lastTerrainHeight = this.lastTerrainHeight + (terrainHeight - this.lastTerrainHeight) * 0.3;
    } else {
      this.lastTerrainHeight = terrainHeight;
    }
    
    // Set the eye Y position to terrain height plus player height
    let newHeight = this.lastTerrainHeight + this.playerHeight;
    
    // Add subtle head bobbing when moving
    if (this.isMoving) {
      this.headBobPhase += 0.1 * this.headBobSpeed;
      newHeight += Math.sin(this.headBobPhase) * this.headBobAmount;
    }
    
    // Calculate how much to move toward the target height
    // Use smooth interpolation rather than instant movement
    const heightDifference = newHeight - this.eye.elements[1];
    const smoothFactor = 0.15; // Lower values make the transition smoother but slower
    const heightChange = heightDifference * smoothFactor;
    
    // Only adjust if there's a significant difference or we're not falling too far
    if (Math.abs(heightDifference) > 0.01 && (heightDifference > 0 || Math.abs(heightDifference) < 1.5)) {
      // Update eye and at positions with the smoothed height change
      this.eye.elements[1] += heightChange;
      this.at.elements[1] += heightChange;
    }
  }
  
  // Update the view matrix based on current eye, at, and up vectors
  updateViewMatrix() {
    // Apply terrain height adjustment before updating view matrix
    // for smooth movement over terrain
    this.adjustHeightToTerrain();
    
    this.viewMatrix.setLookAt(
      this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
      this.at.elements[0], this.at.elements[1], this.at.elements[2],
      this.up.elements[0], this.up.elements[1], this.up.elements[2]
    );
  }
  
  // Move the camera forward
  moveForward(speed = this.moveSpeed) {
    // Mark that we're moving
    this.isMoving = true;
    
    // Compute forward vector
    let forward = new Vector3();
    forward.set(this.at);
    forward.sub(this.eye);
    forward.normalize();
    
    // Only move in XZ plane for FPS-style movement
    forward.elements[1] = 0;
    forward.normalize();
    
    // Scale by speed
    forward.mul(speed);
    
    // Update position
    this.eye.add(forward);
    this.at.add(forward);
    
    // Adjust height based on terrain - done in updateViewMatrix now for smoothness
    
    // Update view matrix
    this.updateViewMatrix();
  }
  
  // Move the camera backward
  moveBackward(speed = this.moveSpeed) {
    // Mark that we're moving
    this.isMoving = true;
    
    // Compute backward vector
    let backward = new Vector3();
    backward.set(this.eye);
    backward.sub(this.at);
    backward.normalize();
    
    // Only move in XZ plane for FPS-style movement
    backward.elements[1] = 0;
    backward.normalize();
    
    // Scale by speed
    backward.mul(speed);
    
    // Update position
    this.eye.add(backward);
    this.at.add(backward);
    
    // Adjust height based on terrain - done in updateViewMatrix now for smoothness
    
    // Update view matrix
    this.updateViewMatrix();
  }
  
  // Move the camera to the left
  moveLeft(speed = this.moveSpeed) {
    // Mark that we're moving
    this.isMoving = true;
    
    // Compute forward vector
    let forward = new Vector3();
    forward.set(this.at);
    forward.sub(this.eye);
    forward.normalize();
    
    // Compute the side vector (cross product of up and forward)
    let side = new Vector3();
    side.set(Vector3.cross(this.up, forward));
    side.normalize();
    
    // Only move in XZ plane for FPS-style movement
    side.elements[1] = 0;
    side.normalize();
    
    // Scale by speed
    side.mul(speed);
    
    // Update position
    this.eye.add(side);
    this.at.add(side);
    
    // Adjust height based on terrain - done in updateViewMatrix now for smoothness
    
    // Update view matrix
    this.updateViewMatrix();
  }
  
  // Move the camera to the right
  moveRight(speed = this.moveSpeed) {
    // Mark that we're moving
    this.isMoving = true;
    
    // Compute forward vector
    let forward = new Vector3();
    forward.set(this.at);
    forward.sub(this.eye);
    forward.normalize();
    
    // Compute the side vector (cross product of forward and up)
    let side = new Vector3();
    side.set(Vector3.cross(forward, this.up));
    side.normalize();
    
    // Only move in XZ plane for FPS-style movement
    side.elements[1] = 0;
    side.normalize();
    
    // Scale by speed
    side.mul(speed);
    
    // Update position
    this.eye.add(side);
    this.at.add(side);
    
    // Adjust height based on terrain - done in updateViewMatrix now for smoothness
    
    // Update view matrix
    this.updateViewMatrix();
  }
  
  // Move the camera up/down
  moveUp(speed = this.moveSpeed) {
    // Compute up vector (only Y direction for flight-style movement)
    let up = new Vector3([0, 1, 0]);
    
    // Scale by speed
    up.mul(speed);
    
    // Update position
    this.eye.add(up);
    this.at.add(up);
    
    // Update view matrix
    this.updateViewMatrix();
  }
  
  // Rotate the camera left (around Y-axis)
  panLeft(degrees = this.rotateSpeed) {
    // Create rotation matrix
    let rotMatrix = new Matrix4();
    rotMatrix.setRotate(degrees, 0, 1, 0);
    
    // Compute view direction vector and rotate it
    let viewDir = new Vector3();
    viewDir.set(this.at);
    viewDir.sub(this.eye);
    
    // Apply rotation to view direction
    let newViewDir = rotMatrix.multiplyVector3(viewDir);
    
    // Update look-at point
    this.at.set(this.eye);
    this.at.add(newViewDir);
    
    // Update view matrix
    this.updateViewMatrix();
  }
  
  // Rotate the camera right (around Y-axis)
  panRight(degrees = this.rotateSpeed) {
    this.panLeft(-degrees);
  }
  
  // Return the current camera position (eye position)
  getPosition() {
    return [this.eye.elements[0], this.eye.elements[1], this.eye.elements[2]];
  }
  
  // Handle mouse movement for camera rotation
  handleMouseMove(event, canvas) {
    if (!this.mouseEnabled) return;
    
    // Use movementX/Y for pointer lock API
    let dx = 0;
    let dy = 0;
    
    if (document.pointerLockElement === canvas || 
        document.mozPointerLockElement === canvas || 
        document.webkitPointerLockElement === canvas) {
      // Pointer is locked, use movement values
      dx = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
      dy = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
    } else {
      // Fallback to regular mouse tracking when not locked
      const newX = event.clientX;
      const newY = event.clientY;
      
      // Check if this is the first capture
      if (this.lastMouseX !== 0 && this.lastMouseY !== 0) {
        // Calculate deltas
        dx = newX - this.lastMouseX;
        dy = newY - this.lastMouseY;
      }
      
      // Store current position for next frame
      this.lastMouseX = newX;
      this.lastMouseY = newY;
    }
    
    // Only process if there was actual movement
    if (dx !== 0 || dy !== 0) {
      // Scale by sensitivity
      const yawDelta = -dx * this.mouseSensitivity;  // Negative sign to reverse the direction
      const pitchDelta = dy * this.mouseSensitivity;
      
      // Update camera angles
      this.yaw += yawDelta;
      this.pitch -= pitchDelta;  // Inverted for natural feel
      
      // Clamp pitch to prevent flipping
      if (this.pitch > 89) this.pitch = 89;
      if (this.pitch < -89) this.pitch = -89;
      
      // Convert to radians
      const yawRad = this.yaw * Math.PI / 180;
      const pitchRad = this.pitch * Math.PI / 180;
      
      // Calculate new look-at point
      const radius = 1.0;  // Distance from eye to look-at
      const atX = this.eye.elements[0] + radius * Math.cos(pitchRad) * Math.sin(yawRad);
      const atY = this.eye.elements[1] + radius * Math.sin(pitchRad);
      const atZ = this.eye.elements[2] + radius * Math.cos(pitchRad) * Math.cos(yawRad);
      
      // Update look-at point
      this.at.elements[0] = atX;
      this.at.elements[1] = atY;
      this.at.elements[2] = atZ;
      
      // Update view matrix
      this.updateViewMatrix();
      
      // Flag that mouse has moved (for optimization in render loop)
      this.mouseMovedSinceLastFrame = true;
    }
  }
  
  // Enable mouse control
  enableMouseControl(canvas) {
    this.mouseEnabled = true;
    
    // Get initial direction to set up yaw/pitch
    const dir = new Vector3();
    dir.elements[0] = this.at.elements[0] - this.eye.elements[0];
    dir.elements[1] = this.at.elements[1] - this.eye.elements[1];
    dir.elements[2] = this.at.elements[2] - this.eye.elements[2];
    dir.normalize();
    
    // Calculate initial yaw and pitch
    this.yaw = -Math.atan2(dir.elements[0], -dir.elements[2]) * 180 / Math.PI;
    this.pitch = Math.asin(dir.elements[1]) * 180 / Math.PI;
    
    // Set initial mouse position
    this.lastMouseX = canvas.width / 2;
    this.lastMouseY = canvas.height / 2;
    
    // Request pointer lock for better mouse control
    canvas.requestPointerLock = canvas.requestPointerLock || 
                               canvas.mozRequestPointerLock || 
                               canvas.webkitRequestPointerLock;
                               
    // Setup pointer lock on click event
    canvas.onclick = () => {
      // Only request pointer lock if not already locked
      if (document.pointerLockElement !== canvas && 
          document.mozPointerLockElement !== canvas && 
          document.webkitPointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    };
  }
  
  // Disable mouse control
  disableMouseControl() {
    this.mouseEnabled = false;
    document.exitPointerLock = document.exitPointerLock || 
                              document.mozExitPointerLock || 
                              document.webkitExitPointerLock;
    document.exitPointerLock();
  }
  
  // Method to check collision with world objects
  checkCollision(worldMap, worldSize) {
    // This is a simple collision detection, can be expanded
    // We're checking if the camera is inside a block (or slightly outside the world)
    
    // Get camera position
    const x = this.eye.elements[0];
    const z = this.eye.elements[2];
    
    // Check if outside world boundaries
    if (x < 0 || x >= worldSize || z < 0 || z >= worldSize) {
      return true;
    }
    
    // Get map cell
    const mapX = Math.floor(x);
    const mapZ = Math.floor(z);
    
    // Check if inside a wall
    if (mapX >= 0 && mapX < worldMap.length && 
        mapZ >= 0 && mapZ < worldMap[0].length) {
      return worldMap[mapX][mapZ] > 0;
    }
    
    return false;
  }
} 