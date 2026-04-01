/*:
 * @target MZ
 * @plugindesc 在事件/NPC頭上顯示指定變數的數值，可用於顯示獲利金額 v1.0
 * @author ChatGPT
 *
 * @param showSwitchId
 * @text 顯示控制開關ID
 * @type switch
 * @default 0
 * @desc 若設為0則永遠顯示；若設為其他開關ID，則該開關ON時才顯示。
 *
 * @param fontSize
 * @text 字體大小
 * @type number
 * @min 8
 * @default 22
 *
 * @param offsetY
 * @text 垂直偏移
 * @type number
 * @default -90
 * @desc 數值越小會顯示得越高。
 *
 * @param showZero
 * @text 是否顯示0
 * @type boolean
 * @on 顯示
 * @off 不顯示
 * @default false
 *
 * @help
 * === 使用方式 ===
 *
 * 在要顯示數字的事件頁「註解」中加入：
 *
 * <profitVar:11>
 *
 * 代表此NPC頭上會顯示第11號變數的值。
 *
 * 例如：
 * <profitVar:11>   儲蓄NPC
 * <profitVar:12>   低風險NPC
 * <profitVar:13>   中風險NPC
 * <profitVar:14>   高風險NPC
 *
 * === 顯示規則 ===
 * 正數：顯示 +100
 * 負數：顯示 -50
 * 0：依插件參數 showZero 決定是否顯示
 *
 * === 顯示控制 ===
 * 可以用插件參數「顯示控制開關ID」控制是否顯示。
 * 例如設成 21：
 * - 開關21 OFF → 不顯示
 * - 開關21 ON  → 顯示
 *
 * 很適合做成：
 * 玩家全部分配完5000元後，才打開開關，讓所有NPC頭上顯示獲利。
 *
 * === 注意 ===
 * 1. 註解請放在事件目前使用的事件頁中。
 * 2. 若同一事件頁有多個 <profitVar:x>，只讀第一個。
 * 3. 本插件只作用在地圖事件，不作用於玩家。
 */

(() => {
    "use strict";

    const pluginName = "NPCProfitLabel";
    const params = PluginManager.parameters(pluginName);

    const SHOW_SWITCH_ID = Number(params.showSwitchId || 0);
    const FONT_SIZE = Number(params.fontSize || 22);
    const OFFSET_Y = Number(params.offsetY || -90);
    const SHOW_ZERO = String(params.showZero || "false") === "true";

    function extractProfitVarId(event) {
        if (!event || !event.page()) return 0;
        const list = event.list();
        if (!list) return 0;

        for (const command of list) {
            // 108: 註解開始, 408: 註解續行
            if (command.code === 108 || command.code === 408) {
                const text = command.parameters[0];
                const match = /<profitVar\s*:\s*(\d+)\s*>/i.exec(text);
                if (match) {
                    return Number(match[1]);
                }
            }
        }
        return 0;
    }

    function shouldShowProfitLabel() {
        if (SHOW_SWITCH_ID <= 0) return true;
        return $gameSwitches.value(SHOW_SWITCH_ID);
    }

    function formatProfitValue(value) {
        if (value > 0) return `+${value}`;
        if (value < 0) return `${value}`;
        if (SHOW_ZERO) return "0";
        return "";
    }

    class Sprite_ProfitLabel extends Sprite {
        initialize(characterSprite) {
            super.initialize();
            this._characterSprite = characterSprite;
            this._event = null;
            this._varId = 0;
            this._lastText = null;

            this.bitmap = new Bitmap(160, 36);
            this.anchor.x = 0.5;
            this.anchor.y = 1.0;

            this.bitmap.fontSize = FONT_SIZE;
            this.bitmap.outlineWidth = 4;

            this.updateBinding();
            this.update();
        }

        update() {
            super.update();
            this.updateBinding();
            this.updatePosition();
            this.updateText();
            this.updateVisibility();
        }

        updateBinding() {
            const character = this._characterSprite?._character;
            if (character && character instanceof Game_Event) {
                if (this._event !== character) {
                    this._event = character;
                    this._varId = extractProfitVarId(this._event);
                    this._lastText = null;
                } else {
                    // 若事件頁切換，也重新抓一次註解
                    const newVarId = extractProfitVarId(this._event);
                    if (newVarId !== this._varId) {
                        this._varId = newVarId;
                        this._lastText = null;
                    }
                }
            } else {
                this._event = null;
                this._varId = 0;
                this._lastText = null;
            }
        }

        updatePosition() {
            if (!this._characterSprite) return;
            this.x = this._characterSprite.x;
            this.y = this._characterSprite.y + OFFSET_Y;
        }

        updateText() {
            if (!this._varId) {
                if (this._lastText !== "") {
                    this._lastText = "";
                    this.redraw("");
                }
                return;
            }

            const value = $gameVariables.value(this._varId);
            const text = formatProfitValue(value);

            if (text !== this._lastText) {
                this._lastText = text;
                this.redraw(text);
            }
        }

        updateVisibility() {
            if (!this._event || !this._varId) {
                this.visible = false;
                return;
            }

            if (!shouldShowProfitLabel()) {
                this.visible = false;
                return;
            }

            const value = $gameVariables.value(this._varId);
            const text = formatProfitValue(value);

            if (text === "") {
                this.visible = false;
                return;
            }

            this.visible = true;
        }

        redraw(text) {
            this.bitmap.clear();
            if (!text) return;

            const color = this.textColorFor(text);
            this.bitmap.textColor = color;
            this.bitmap.drawText(text, 0, 0, this.bitmap.width, this.bitmap.height, "center");
        }

        textColorFor(text) {
            if (text.startsWith("+")) return "#00ff66";
            if (text.startsWith("-")) return "#ff6666";
            return "#ffffff";
        }
    }

    const _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;
    Spriteset_Map.prototype.createCharacters = function() {
        _Spriteset_Map_createCharacters.call(this);
        this.createProfitLabels();
    };

    Spriteset_Map.prototype.createProfitLabels = function() {
        this._profitLabels = [];

        for (const sprite of this._characterSprites) {
            if (sprite._character instanceof Game_Event) {
                const label = new Sprite_ProfitLabel(sprite);
                this._tilemap.addChild(label);
                this._profitLabels.push(label);
            }
        }
    };

    const _Spriteset_Map_destroy = Spriteset_Map.prototype.destroy;
    Spriteset_Map.prototype.destroy = function(options) {
        if (this._profitLabels) {
            for (const label of this._profitLabels) {
                if (label && label.parent) {
                    label.parent.removeChild(label);
                }
            }
            this._profitLabels = null;
        }
        _Spriteset_Map_destroy.call(this, options);
    };

})();