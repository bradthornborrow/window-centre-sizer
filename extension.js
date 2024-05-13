/*
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

const {Clutter, Meta, Shell, St} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;

const MESSAGE_FADE_TIME = 2000;

let text;

/** */
function hideMessage() {
    text.destroy();
    text = null;
}

/**
 * @param {string} message - the message to flash
 */
function flashMessage(message) {
    if (!text) {
        text = new St.Label({style_class: 'window-centre-sizer-message'});
        Main.uiGroup.add_actor(text);
    }

    text.remove_all_transitions();
    text.text = message;

    text.opacity = 255;

    let monitor = Main.layoutManager.primaryMonitor;
    text.set_position(
        monitor.x + Math.floor(monitor.width / 2 - text.width / 2),
        monitor.y + Math.floor(monitor.height / 2 - text.height / 2));

    text.ease({
        opacity: 0,
        duration: MESSAGE_FADE_TIME,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onComplete: hideMessage,
    });
}

let SIZES = [
    [1024, 640],
    [1140, 680],
];

/**
 * @param {Meta.Display} display - the display
 * @param {Meta.Window=} window - for per-window bindings, the window
 * @param {Meta.KeyBinding} binding - the key binding
 */
function cycleWindowSizes(display, window, binding) {
    let modifiers = binding.get_modifiers();
    let backwards = (modifiers & Meta.VirtualModifier.SHIFT_MASK) !== 0;

    // Unmaximize first
    if (window.get_maximized() !== 0)
        window.unmaximize(Meta.MaximizeFlags.BOTH);

    let workArea = window.get_work_area_current_monitor();
    let outerRect = window.get_frame_rect();

    // Double both axes if on a hidpi display
    let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
    let scaledSizes = SIZES.map(size => size.map(wh => wh * scaleFactor))
        .filter(([w, h]) => w <= workArea.width && h <= workArea.height);

    // Find the nearest 16:9 size for the current window size
    let nearestIndex;
    let nearestError;

    for (let i = 0; i < scaledSizes.length; i++) {
        let [width, height] = scaledSizes[i];

        // get the best initial window size
        let error = Math.abs(width - outerRect.width) + Math.abs(height - outerRect.height);
        if (nearestIndex === undefined || error < nearestError) {
            nearestIndex = i;
            nearestError = error;
        }
    }

    // get the next size up or down from ideal
    let newIndex = (nearestIndex + (backwards ? -1 : 1)) % scaledSizes.length;
    let [newWidth, newHeight] = scaledSizes[newIndex];

    // Centre window onscreen
    let newX = (workArea.width - newWidth) / 2;
    // Vertical centre is adjusted for Gnome menu bar size (default 32 pixels)
    let newY = ((workArea.height - newHeight) / 2) + (32 * scaleFactor);

    // Push the window onscreen if it would be resized offscreen
    if (newX + newWidth > workArea.x + workArea.width)
        newX = Math.max(workArea.x + workArea.width - newWidth);
    if (newY + newHeight > workArea.y + workArea.height)
        newY = Math.max(workArea.y + workArea.height - newHeight);

    const id = window.connect('size-changed', () => {
        window.disconnect(id);
        _notifySizeChange(window);
    });
    window.move_resize_frame(true, newX, newY, newWidth, newHeight);
}

/**
 * @param {Meta.Window} window - the window whose size changed
 */
function _notifySizeChange(window) {
    const {scaleFactor} = St.ThemeContext.get_for_stage(global.stage);
    let newOuterRect = window.get_frame_rect();
    let message = '%d×%d'.format(
        newOuterRect.width / scaleFactor,
        newOuterRect.height / scaleFactor);

    flashMessage(message);
}

/** */
function enable() {
    Main.wm.addKeybinding(
        'cycle-window-sizes',
        ExtensionUtils.getSettings(),
        Meta.KeyBindingFlags.PER_WINDOW,
        Shell.ActionMode.NORMAL,
        cycleWindowSizes);
    Main.wm.addKeybinding(
        'cycle-window-sizes-backward',
        ExtensionUtils.getSettings(),
        Meta.KeyBindingFlags.PER_WINDOW | Meta.KeyBindingFlags.IS_REVERSED,
        Shell.ActionMode.NORMAL,
        cycleWindowSizes);
}

/** */
function disable() {
    Main.wm.removeKeybinding('cycle-window-sizes');
    Main.wm.removeKeybinding('cycle-window-sizes-backward');
}
