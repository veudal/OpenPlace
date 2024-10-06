# OpenPlace

A reddit r/place clone (online pixel art plattform where all users share a canvas) implemented in Angular. All data is stored in a SQL Database on Microsoft Azure.

DISCLAIMER: User-generated content may not be monitored and you may encounter inappropriate material.

Here is a timelapse of the first 100k pixels:

https://github.com/user-attachments/assets/7572b5cd-b8eb-48a8-9dd8-fb09685679e2


# How to use (tricks & extra infos)

- Press left-click to place a pixel.
- Press mousewheel or right-click on a pixel to set your drawing color to the color of that pixel.
- Use the 0-9 keys on your keyboard to view only the pixels placed by one of the top 10 usernames on the leaderboard.
- Press escape to exit history mode (set the slider to max) and show the pixels of all users.
- Hover over a pixel in order to view its (X|Y) coordinates, username and the timestamp of its last update.
- The first color in the color palette is a special one. Once clicked, you can choose a completly custom color from the color picker.
- Every placed pixel stores a username. Make sure to set one in the username box, otherwise your pixels will be shown as "Anonymous".
- Use your scroll wheel on the canvas in order to zoom in or out on a certain point.
- Use WASD (or the arrow keys) in order to move/navigate through the canvas. NOTE: Moving only works when the zoom level is greater than 1.
- Press Q & E to either select the previous or next color in the palette.
- Scroll the mousewheel while over the color palette or globally by holding either the CTRL, SHIFT or ALT key to scroll through the colors.
- Press - & + to either zoom in or out on the current center.
- Press SPACE to select the first color (your custom color).
- Pan (move around) on the canvas by holding right click and the moving the mouse.
- Use @ to mention someone in the chat. This will highlight the message for them, update their tab title accordingly and also make a sound to notify them.
- Click on a username in the chat to automatically add a mention in the chat input box.

  ### Additional info
  - The stored username of placed pixels will not be changed with a new username.
  - The leaderboard counts by the usernames. If 2 people have the same one, all their totals will add up and be shown as one in the leaderboard.

# Screenshots

![image](https://github.com/user-attachments/assets/afe227d0-0883-4d45-a5b5-ec054d879426)

![image](https://github.com/user-attachments/assets/fc139c57-99b2-4610-a2c6-fee1a7c8fa28)

# Rules

Before creating anything, please read our [canvas guidelines](https://github.com/veudal/openplace/blob/master/rules.md)

# Features

- Slider to see every pixel change from the beginning
- Chat with other users
- Realtime updates from other users
- Usernames
- Canvas zoom
- Keyboard shortcuts for zoom (- & +)
- Automatic zoom and position recovery on opening
- Canvas movement (WASD or arrow keys)
- Canvas panning
- User filter for top 10 users (by pixels placed)
- Leaderboard
- Pixel hover info (coordinates, username, timestamp)
- Hover/preview pixel on mouse over
- Info bubbles for each pixel (timestamp, username, and coordinates)
- 34 preset colors and one custom color
- Color picker
- Color palette navigation shortcuts (Q & E, mousewheel, space)
