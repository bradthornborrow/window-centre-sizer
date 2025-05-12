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

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const MESSAGE_FADE_TIME = 2000;

export default class WindowCentreSizerExtension extends Extension {
    SIZES = [
        [0.72, 0.78],
        [0.84, 0.88],
        [0.96, 0.94],
    ];

    _flashMessage(message) {
        if (!this._text) {
            this._text = new St.Label({style_class: 'window-centre-sizer-message'});
            Main.uiGroup.add_child(this._text);
        }

        this._text.remove_all_transitions();
        this._text.text = message;

        this._text.opacity = 255;

        const monitor = Main.layoutManager.primaryMonitor;
        this._text.set_position(
            monitor.x + Math.floor(monitor.width / 2 - this._text.width / 2),
            monitor.y + Math.floor(monitor.height / 2 - this._text.height / 2));

        this._text.ease({
            opacity: 0,
            duration: MESSAGE_FADE_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._hideMessage(),
        });
    }

    _hideMessage() {
        this._text.destroy();
        delete this._text;
    }

    /**
     * @param {Meta.Display} display - the display
     * @param {Meta.Window=} window - for per-window bindings, the window
     * @param {Clutter.Event} event - the triggering event
     * @param {Meta.KeyBinding} binding - the key binding
     */
    _cycleWindowSizes(display, window, event, binding) {
        const backwards = binding.is_reversed();

        // Unmaximize first
        if (window.get_maximized() !== 0)
            window.unmaximize(Meta.MaximizeFlags.BOTH);

        let workArea = window.get_work_area_current_monitor();
        let outerRect = window.get_frame_rect();

        // Double both axes if on a hidpi display
        let scaledSizes = this.SIZES.map(row => row.map((element, columnIndex) => (columnIndex === 0) ? Math.trunc(element * workArea.width) : Math.trunc(element * workArea.height)));
        console.log(scaledSizes);

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
        let [newWidth, newHeight] = scaledSizes.at(newIndex);

        // Centre window onscreen
        let newX = (workArea.width - newWidth) / 2;
        // Vertical centre is adjusted for Gnome menu bar size (default 32 pixels)
        let newY = ((workArea.height - newHeight) / 2) + (32 * St.ThemeContext.get_for_stage(global.stage).scale_factor);

        const id = window.connect('size-changed', () => {
            window.disconnect(id);
            this._notifySizeChange(window);
        });
        window.move_resize_frame(true, newX, newY, newWidth, newHeight);
    }

    /**
     * @param {Meta.Window} window - the window whose size changed
     */
    _notifySizeChange(window) {
        let newOuterRect = window.get_frame_rect();
        let message = '%d×%d'.format(
            newOuterRect.width,
            newOuterRect.height);

        this._flashMessage(message);
    }

    enable() {
        Main.wm.addKeybinding(
            'cycle-window-sizes',
            this.getSettings(),
            Meta.KeyBindingFlags.PER_WINDOW,
            Shell.ActionMode.NORMAL,
            this._cycleWindowSizes.bind(this));
        Main.wm.addKeybinding(
            'cycle-window-sizes-backward',
            this.getSettings(),
            Meta.KeyBindingFlags.PER_WINDOW | Meta.KeyBindingFlags.IS_REVERSED,
            Shell.ActionMode.NORMAL,
            this._cycleWindowSizes.bind(this));
    }

    disable() {
        Main.wm.removeKeybinding('cycle-window-sizes');
        Main.wm.removeKeybinding('cycle-window-sizes-backward');
    }
}
