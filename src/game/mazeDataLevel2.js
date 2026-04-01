/**
 * mazeDataLevel2.js — Wall definitions for AngleMaze Level 2 (Diagonal Walls).
 *
 * WHAT: Same format as mazeData.js — each wall is { x1, y1, x2, y2 }.
 *   The difference: this level includes DIAGONAL walls at various angles
 *   (30°, 45°, 60°, 135°, etc.) to force the student to use non-90° turns.
 *
 * WHY diagonal walls matter for learning:
 *   In Level 1, every wall is horizontal or vertical. A student can solve the
 *   entire maze using only 90° turns — they never need to read a protractor.
 *   In Level 2, the walls are tilted. To navigate around a 45° wall, the
 *   student must turn 45° — which means measuring 45° on the protractor.
 *   THIS is the learning moment: connecting the game to the real tool.
 *
 * HOW diagonal walls differ in physics:
 *   Horizontal/vertical walls use ONE rectangle physics body (fast, simple).
 *   Diagonal walls use a CHAIN of small square bodies placed along the line
 *   (see createDiagonalWallBodies in MazeScene.js for the full explanation).
 *   The visual rendering is the same — lineBetween works at any angle.
 *
 * MAZE LAYOUT (800 × 600 canvas):
 *
 *   ★ = START (60, 60)       ✦ = EXIT (740, 540)
 *
 *   The solution path requires turns of 45°, 60°, and 30° — not just 90°.
 *   Several dead ends punish students who only try 90° turns.
 *
 * COORDINATE REMINDER:
 *   (0,0) = top-left.  X increases → (right).  Y increases ↓ (down).
 */

const walls = [

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTER BOUNDARY (same as Level 1 — horizontal and vertical)
  // These four walls enclose the 800 × 600 play area.
  // ═══════════════════════════════════════════════════════════════════════════

  { x1:   0, y1:   0, x2: 800, y2:   0 },  // top edge (horizontal)
  { x1:   0, y1: 600, x2: 800, y2: 600 },  // bottom edge (horizontal)
  { x1:   0, y1:   0, x2:   0, y2: 600 },  // left edge (vertical)
  { x1: 800, y1:   0, x2: 800, y2: 600 },  // right edge (vertical)

  // ═══════════════════════════════════════════════════════════════════════════
  // Personalized Maze Hand-Made. I have splited the maze in 4 columns
  // ═══════════════════════════════════════════════════════════════════════════

   // ═══════════════════════════════════════════════════════════════════════════
  // First Column
  // ═══════════════════════════════════════════════════════════════════════════
  //          |
  //        |\|
  //        |

  { x1: 252, y1:   0, 
    x2: 150, y2:  120 },

  { x1:  150, y1:  120,
    x2:  100, y2: 80 },
  
  { x1:  100, y1:  80,
    x2:  100, y2: 150 },

  { x1:  100, y1: 150,
    x2:  90, y2: 250 },
  
  //          |
  //          |
  //         /\
  //        /--\

  { x1:  160, y1: 250,
    x2:  160, y2: 320 },

  { x1:  160, y1: 320,
    x2:  100, y2: 450 },
  
  { x1:  160, y1: 320,
    x2:  200, y2: 450 },
  
  { x1:  90, y1: 450,
    x2:  200, y2: 450 },
  
  
  
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Second Column
  // ═══════════════════════════════════════════════════════════════════════════
  //              \/
  //          | 
  //        /|\

  
  { x1: 330, y1: 100,      //      |
    x2: 310, y2: 170 },  //      |
  
  { x1: 320, y1: 125, 
    x2: 270, y2: 150 },  //     / 
  
  { x1: 320, y1: 128, 
    x2: 355, y2: 148 },  //      \

  
  //  

  { x1: 400, y1: 30, 
    x2: 460, y2: 120 },  //     \ 
  
  { x1: 460, y1: 120, 
    x2: 540, y2: 0 },  //      /

    
  //         / \
  //         \______
  //         
  //        

  { x1: 350, y1: 250, 
    x2: 400, y2: 300},
  
  { x1: 350, y1: 250, 
    x2: 270, y2: 300},
  
  { x1: 270, y1: 300, 
    x2: 320, y2: 400 },

  { x1:  320, y1: 400,
    x2:  520, y2: 400 },

  
  //      \____

  { x1:  200, y1: 450,
    x2:  300, y2: 510 },

  { x1:  300, y1: 510,
    x2:  400, y2: 510 },


  // ═══════════════════════════════════════════════════════════════════════════
  // Third Column
  // ═══════════════════════════════════════════════════════════════════════════
  //             /\
  //            / _\
  //          /
  //         |
  //        

  { x1: 495, y1: 270, 
    x2: 500, y2: 200},
  
  { x1: 500, y1: 200, 
    x2: 530, y2: 180},
  
  { x1: 530, y1: 180, 
    x2: 550, y2: 100 },

  { x1:  550, y1: 180,
    x2:  600, y2: 150 },

  { x1:  600, y1: 150,
    x2:  610, y2: 150 },
  
  { x1:  610, y1: 150,
    x2:  560, y2: 100 },

  //         /  \
  //        |  /
  //       |
  //       |           
  //        

  { x1: 520, y1: 380, 
    x2: 520, y2: 600},
  
  { x1: 520, y1: 380, 
    x2: 580, y2: 340},
  
  { x1: 580, y1: 340, 
    x2: 590, y2: 370 },

  { x1: 590, y1: 370,
    x2: 570, y2: 420 },

  // ═══════════════════════════════════════════════════════════════════════════
  // Fourth Column
  // ═══════════════════════════════════════════════════════════════════════════
  //                /
  //            /  /
  //           \   \
  //            \  |
  //           /  /

  { x1: 690, y1: 110, 
    x2: 670, y2: 200 },

  { x1: 670, y1: 200, 
    x2: 700, y2: 330 },

  { x1: 700, y1: 330, 
    x2: 630, y2: 500 }, 

    

  { x1: 800, y1: 60, 
    x2: 760, y2: 200 },

  { x1: 760, y1: 200, 
    x2: 800, y2: 300 },

  { x1: 800, y1: 400, 
    x2: 740, y2: 500 },

  // ═══════════════════════════════════════════════════════════════════════════
  // Enemies
  // ═══════════════════════════════════════════════════════════════════════════
  //      _           
  //    /_/       
  // First from left to right.           

  { x1: 120, y1: 295, 
    x2: 121, y2: 296 },
  
  //      _           
  //    /_/       
  // Second from left to right.           

  { x1: 325, y1: 221, 
    x2: 326, y2: 222 },
  
  //      _           
  //    /_/       
  // Third from left to right.           

  { x1: 523, y1: 97, 
    x2: 524, y2: 98 },
  
  //      _           
  //    /_/       
  // Fourth from left to right.           

  { x1: 625, y1: 190, 
    x2: 626, y2: 191 },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // Check points
  // ═══════════════════════════════════════════════════════════════════════════           
  //    
  // First from right to left.  
  { x1: 650, y1: 550, 
    x2: 651, y2: 551 },
  // Second from right to left.  
  { x1: 450, y1: 340, 
    x2: 451, y2: 341 },
  // Third from right to left.  
  { x1: 200, y1: 180, 
    x2: 201, y2: 181 },
  // Fourth from right to left.  
  { x1: 460, y1: 500, 
    x2: 461, y2: 501 },
];

export default walls;