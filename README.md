# Spicetify Waveform Seekbar

Fixed and maintained by **Greenstone51** (Originally created by **SPOTLAB**).

---

<p align="center">
  <img src="assets/waveform-example.jpg" alt="Waveform Seekbar Example" width="700"/>
</p>

## Description

Waveform is an extension for Spicetify that replaces the default seekbar in the Spotify player with a dynamic waveform visualization. This extension fetches audio analysis data using Spicetify internal client interfaces and generates a visual representation of the track's waveform, similar to SoundCloud and standard DJ software.

Note: This version resolves previous deprecation issues with Spotify Web API endpoints by relying entirely on local, non-intrusive Spicetify internal APIs.

## Features

- **Dynamic Waveform Visualization**: Replaces the standard seekbar with a waveform representation of the current track.
- **Real-time Playback Progress**: The waveform updates in real-time to show the current playback position.
- **Interactive Seeking**: Click anywhere on the waveform to seek to that position in the track.
- **Hover Timestamps**: Displays the time at the cursor position when hovering over the waveform.
- **Adaptive Coloring**: Automatically adjusts to Spicetify's color scheme.
- **Loading Animation**: Shows a dynamic loading animation while fetching track data.
- **Error Handling**: Gracefully falls back to the original seekbar if unable to fetch waveform data.

## Installation

1. Ensure you have [Spicetify](https://github.com/khanhas/spicetify-cli) installed.
2. Download `waveform.js` from this repository.
3. Place `waveform.js` in your Spicetify extensions directory:
   - Windows: `%appdata%\spicetify\Extensions\`
   - Linux: `~/.config/spicetify/Extensions/`
   - MacOS: `~/.config/spicetify/Extensions/`
4. Add the extension name to your Spicetify config: `spicetify config extensions waveform.js`
5. Apply the changes: `spicetify apply`

Alternatively, install this extension directly via the built-in Spicetify Marketplace tab.

## Usage

Once installed and enabled, the extension will automatically replace the default seekbar with the waveform visualization for each track. No additional user action is required.

- **Seeking**: Click anywhere on the waveform to jump to that position in the track.
- **Time Preview**: Hover over the waveform to see the time at that position.

## Customization

The extension includes several customizable parameters:

- `DEBUG`: Set to `true` for verbose console logging.
- `contrastFactor`: Adjust to change the contrast of the waveform (default: 4.0).

To customize these, edit the values in the `waveform.js` file.

## Compatibility

This extension is designed to work with the latest version of Spicetify. It uses internal client bindings to ensure continuous functionality regardless of external Web API policy changes.

## Known Issues

- Some tracks may not have local audio analysis data available, in which case the original seekbar will be displayed.
- This extension will likely not work alongside other extensions that directly manipulate the playback bar element.
- If the player is paused and the waveform seekbar is clicked, the progress will not update until playback resumes.

## License

This project is licensed under the [MIT License](LICENSE.md). Feel free to use, modify, and distribute the code according to the license terms.

## Acknowledgements

- Original implementation by [SPOTLAB](https://github.com/SPOTLAB-Live).
- Maintained and fixed by [Greenstone51](https://github.com/Greenstone51).
- Inspired by the concept by [Lee Martin](https://medium.com/swlh/creating-waveforms-out-of-spotify-tracks-b22030dd442b).
- Thanks to the Spicetify community for ongoing support and tools.
