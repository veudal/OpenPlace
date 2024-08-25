# OpenPlace

A reddit r/place clone (online pixel art plattform in which everyone shares one board) implemented in Angular

# How to use (tricks & extra infos)

- Press left-click to place a pixel.
- Press right-click on a pixel to set your drawing color to the color of that pixel.
- Use the 0-9 keys on your keyboard to select the a specific color on the color palette.
- Hover over a pixel in order to view its (X|Y) coordinates, username and the timestamp of its last update.
- The first color in the color palette is a special one. Once clicked, you can choose a completly custom color from the color picker.
- Every placed pixel stores a username. Make sure to set one in the username box, otherwise your pixels will be shown as "Anonymous".
- Use your scroll wheel on the canvas in order to zoom in or out on a certain point.
- Use WASD (or the arrow keys) in order to move/navigate through the canvas. NOTE: Moving only works when the zoom level is greater than 1.

. The stored username of placed pixels will not be changed with a new username.
- The leaderboard counts by the usernames. If 2 people have the same one, all their totals will add up and be shown as one in the leaderboard.

# Screenshots

![image](https://github.com/user-attachments/assets/afe227d0-0883-4d45-a5b5-ec054d879426)

![image](https://github.com/user-attachments/assets/fc139c57-99b2-4610-a2c6-fee1a7c8fa28)

# Rules

Before creating anything, please read our [canvas guidelines](https://github.com/veudal/openplace/blob/master/rules.md)

# Features
- Usernames
- Zoom
- Moving
- Hover/preview pixel on mouse over
- Info bubbles for each pixel (timestamp, username and x|y coordinates)
- 9 preset colors and one custom color
- Color picker
- Realtime updates from other users
- Keyboard shortcuts
