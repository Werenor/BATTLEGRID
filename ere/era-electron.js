/**
 * @file ere 和引擎通信用的 sdk，使用时复制粘贴到自己的 ere 下，然后 require 引入
 * @author 黑奴队长
 */

/**
 * type of the param 'config' in era.printButton
 * @typedef ButtonConfig
 * @property {'left'|'center'|'right'} [align] align of the button, 'left' in default
 * @property {'dot'|string} [badge] badge of the button if isButton is true
 * @property {'primary'|'success'|'warning'|'danger'|'info'|''} [buttonType] type of the button in element-plus, 'warning' in default when isButton is false
 * @property {string} [color] color of the button, isButton must be false
 * @property {boolean} [disabled] if the button is disabled, false in default
 * @property {boolean} [disableContinue] if the button is disabled, false in default
 * @property {boolean} [disableWarning] if disable warning when accelerator has been set, false in default
 * @property {'left'|'center'|'right'} [inTextAlign] align of the text in the button, 'center' in default
 * @property {boolean} [isButton] if the button is a button, otherwise is a link
 * @property {number} [offset] offset of the button, 0-23, 0 in default
 * @property {boolean} [showAcc] if show the accelerator, true in default on PC, and is always false on Android
 * @property {string} [title] tooltip of the button
 * @property {number} [width] width of the button, 1-24, 1 in default
 */
/**
 * @typedef ButtonObject
 * @property {number} accelerator the accelerator key of the button used in the input
 * @property {ButtonConfig} [config] config of the printed button
 * @property {string} content the text of the button
 * @property {'button'} type
 */
/**
 * type of the param 'config' in era.drawLine
 * @typedef DividerConfig
 * @property {string} [content] content of the divider
 * @property {'left'|'center'|'right'} [position] position of the divider
 * @property {boolean} [isSolid] if the divider is solid
 * @property {number} [offset] offset of the divider
 * @property {number} [width] width of the divider
 */
/**
 * @typedef DividerObject
 * @property {DividerConfig} [config] config of the line
 * @property {'divider'} type
 */
/**
 * @typedef ImageObject
 * @property {string|string[]} names
 * @property {'image'} type
 */
/**
 * type of the param 'config' in era.printProgress
 * @typedef ProgressConfig
 * @property {'left'|'center'|'right'} [align] align of the text shown next to the progress bar, 'left' in default
 * @property {number} [barWidth] width of the progress bar, 0-24, 24 in default
 * @property {string} [color] color of the progress bar
 * @property {string} [fontColor] color of the font in the progress bar
 * @property {number} [height] height of the progress bar, 6-30(px), 24(px) in default
 * @property {number} [offset] offset of the progress, 0-23, 0 in default
 * @property {number} [width] width of the progress, 1-24, 24 in default
 */
/**
 * @typedef ProgressObject
 * @property {ProgressConfig} [config] config of the printed progress
 * @property {string} inContent the text shown in the progress bar
 * @property {string} outContent the text shown next to the progress bar
 * @property {number} percentage the percentage of the progress bar, float, 0-100
 * @property {'progress'} type
 */
/**
 * printed span used in the param 'content' in era.print, era.printAndWait and era.replaceText
 * @typedef PrintedSpan
 * @type {Object}
 * @property {string} [color]
 * @property {string} content
 * @property {string} [display]
 * @property {string} [fontSize]
 * @property {string} [fontStyle]
 * @property {string} [fontWeight]
 * @property {string} [title]
 * @property {string} [url]
 */
/**
 * type of the param 'config' in era.print, era.printAndWait and era.replaceText
 * @typedef TextConfig
 * @property {'left'|'center'|'right'} [align] align of the line, 'left' in default
 * @property {string} [color] color of the line, '#ffffff' in default
 * @property {string} [fontSize] font size of the line, '1rem' in default
 * @property {boolean} [isParagraph] if the line is in a paragraph, false in default
 * @property {number} [offset] offset of the line, 0-23, 0 in default
 * @property {number} [width] width of the line, 1-24, 24 in default
 */
/**
 * @typedef {string|(PrintedSpan|{isBlank:number}|{isBr:boolean}|{isDivider:boolean}|string)[]} TextContent
 */
/**
 * @typedef TextObject
 * @property {TextConfig} [config] config of the printed line
 * @property {TextContent} content
 * @property {'text'} type
 */
/**
 * type of the param 'config' in era.printWholeImage
 * @typedef WholeImageConfig
 * @property {'fill'|'contain'|'cover'|'none'|'scale-down'} [fit] fit of the image
 * @property {number} [offset] offset of the whole image, 0-23, 0 in default
 * @property {number} [width] width of the whole image, 1-24, 24 in default
 */
/**
 * @typedef WholeImageObject
 * @property {WholeImageConfig} [config]
 * @property {string|string[]} names
 * @property {'image.whole'} type
 */

/**
 * @typedef {ButtonObject|DividerObject|ImageObject|ProgressObject|TextObject|WholeImageObject} GridObject
 */
/**
 * @typedef ColumnConfig
 * @type {Object}
 * @property {number} [gutter]
 * @property {'start'|'center'|'end'|'space-between'|'space-around'|'space-evenly'} [horizontalAlign]
 * @property {number} [offset]
 * @property {'top'|'middle'|'bottom'} [verticalAlign]
 * @property {number} [width]
 * @see https://element-plus.org/zh-CN/component/layout.html
 */
/**
 * @typedef ColumnObject
 * @type {Object}
 * @property {GridObject[]} columns
 * @property {ColumnConfig} [config]
 */

const era = {
  /**
   * DANGER add a variable by name
   * @param {string} varName REQUIRED the name of variable, String, like 'callname:1:2'
   * @param {any} val REQUIRED the value to be added
   * @returns {any|undefined} the new value of the variable, or undefined if failed
   */
  // eslint-disable-next-line no-unused-vars
  add(varName, val) {},
  /**
   * add some characters
   * @param {number | number[]} charaId REQUIRED id of the character defined in chara*.csv
   *     <br>if it is an array, is means add the character charaId[0] with the data of the character charaId[1]
   * @returns {boolean | boolean[]}
   */
  // eslint-disable-next-line no-unused-vars
  addCharacter(...charaId) {},
  /**
   * initialize data of some characters for training
   * @param {...number} charaId REQUIRED ids of the characters defined in chara*.csv
   * @returns {void} */
  // eslint-disable-next-line no-unused-vars
  addCharacterForTrain(...charaId) {},
  /**
   * initialize training and character data
   * @param {...number} charaId REQUIRED ids of the characters defined in chara*.csv
   */
  // eslint-disable-next-line no-unused-vars
  beginTrain(...charaId) {},
  /**
   * check if a or some images are loaded
   * @param name the name of the image
   * @returns {boolean|boolean[]}
   */
  // eslint-disable-next-line no-unused-vars
  checkImage(...name) {},
  /**
   * clear printed lines
   * @param {number} [lineCount] how many lines to be cleared, leave undefined to clear all
   * @returns {Promise<number>} new line count
   */
  // eslint-disable-next-line no-unused-vars
  async clear(lineCount) {},
  /**
   * make the current function to wait for some time
   * @param delay time to delay, ms
   * @return {Promise<unknown>}
   */
  delay(delay) {
    return new Promise((resolve) => setTimeout(() => resolve(), delay));
  },
  /**
   * draw a divider to separate lines. the divider is also a line
   * @param {DividerConfig} [config] config of the line
   * @returns {number} line number of the printed
   */
  // eslint-disable-next-line no-unused-vars
  drawLine(config) {},
  /**
   * end training, add gotjewel table into jewel table, and destroy temporary data
   */
  endTrain() {},
  /**
   * get a variable by name
   * @param {string} varName REQUIRED the name of variable, String, like 'callname:1:2'
   * @returns {any|undefined} the variable, or undefined if failed
   */
  // eslint-disable-next-line no-unused-vars
  get(varName) {},
  /**
   * get all added characters
   * @returns {number[]} the list of added characters' ids
   */
  getAddedCharacters() {},
  /**
   * get all characters
   * @returns {number[]} the list of all characters' ids
   */
  getAllCharacters() {},
  /**
   * get characters added in train
   * @returns {number[]} ids of characters in train
   */
  getCharactersInTrain() {},
  /**
   * get the number of current lines
   * @returns {number} the number of current lines
   */
  getLineCount() {},
  /**
   * wait for use's input, the engine will try to return number
   * @param [config] config of input, like rule
   * @param {boolean} config.[disableBefore] if disable before buttons
   * @param {string} config.[rule] the regex string of the rule
   * @param {boolean} config.[useRule] if use the rule
   * @param {boolean} config.[hideInput] if hide the input content
   * @param {boolean} config.[show] (for Android) if show the input element when using buttons
   * @returns {Promise<any>} a promise of the user input, please use await
   */
  // eslint-disable-next-line no-unused-vars
  async input(config) {},
  /**
   * check if is debug mode
   * @returns {boolean} if is in debug mode
   */
  isDebug() {},
  isEra: true,
  /**
   * (android) check if is landscape
   * @returns {Promise<boolean>} if is landscape; always true on PC
   */
  async isLandscape() {},
  /**
   * load a save file
   * @param {number} savIndex REQUIRED the index of the save file
   * @returns {Promise<boolean>} if the loading succeeds
   */
  // eslint-disable-next-line no-unused-vars
  async loadData(savIndex) {},
  /**
   * load global variables from save file
   * @returns {Promise<boolean>} if the loading succeeds
   */
  async loadGlobal() {},
  logger: {
    assert(checkVal, aimVal) {
      if (checkVal !== aimVal && era.version.engine === undefined) {
        console.debug(
          '[ASSERT]',
          new Error(`assert failed! aim val: ${aimVal}, got val: ${checkVal}`)
            .stack,
        );
        return;
      }
      return era.logger.assert(checkVal, aimVal);
    },
    /**
     * to log something into program logs as debug level
     * @param {any} msg
     */
    debug(msg) {
      if (era.version.engine === undefined) {
        console.debug('[DEBUG]', msg);
        return;
      }
      return era.logger.debug(msg);
    },
    /**
     * to log something into program logs as error level
     * @param {any} msg
     * @param {any} [stack]
     */
    error(msg, stack) {
      if (era.version.engine === undefined) {
        console.error('[ERROR]', msg, stack);
        return;
      }
      return era.logger.error(msg, stack);
    },
    /**
     * to log something into program logs as info level
     * @param {any} msg
     */
    info(msg) {
      if (era.version.engine === undefined) {
        console.log('[INFO]', msg);
        return;
      }
      return era.logger.info(msg);
    },
    /**
     * to log something into program logs as warn level
     * @param {any} msg
     * @param {any} [stack]
     */
    warn(msg, stack) {
      if (era.version.engine === undefined) {
        console.warn('[WARN]', msg, stack);
        return;
      }
      return era.logger.warn(msg, stack);
    },
  },
  /**
   * add delta table into param table, nowex table into ex table, and clean source, delta and nowex table
   */
  nextTurnInTrain() {},
  /**
   * show a notification
   * @param {string|({[color]:string,content:string,[fontSize]:string,[fontWeight]:string}|{isBr:true}|string)[]} content content of the notification
   * @param {string} [title] title of the notification
   * @param {'success'|'info'|'warning'|'error'|''} [type] type of the notification, see the enum
   * @param {number} [duration] duration of the notification, microsecond
   */
  // eslint-disable-next-line no-unused-vars
  notify(content, title, type, duration) {},
  /**
   * play the music that must be declared in csv files in directory res
   * @param {string[]|string} names REQUIRED music name, the engine will play the first available music in the array
   * @param [config]
   * @param {boolean} config.[loop] if the music is played in loop
   * @param {boolean} config.[fade] if the music needs fade-in and fade-out
   * @param {number} config.[fadeInternal] the internal of fade-in and fade-out, microsecond, default 200ms
   * @returns {boolean} if the playing succeeds
   */
  // eslint-disable-next-line no-unused-vars
  playMusic(names, config) {},
  /**
   * print some text
   * @param {TextContent} content REQUIRED the text to be printed
   * @param {TextConfig} [config] config of the printed line
   * @returns {number} line number of the printed line
   */
  // eslint-disable-next-line no-unused-vars
  print(content, config) {},
  /**
   * print some text and wait any key from user
   * @param {TextContent} content REQUIRED the text to be printed
   * @param {TextConfig} [config] config of the printed line
   * @returns {Promise<number>} line number of the printed line
   */
  // eslint-disable-next-line no-unused-vars
  async printAndWait(content, config) {},
  /**
   * print a button
   * @param {string} content REQUIRED the text of the button
   * @param {number} accelerator REQUIRED the accelerator key of the button used in the input
   * @param {ButtonConfig} [config] config of the printed button
   * @returns {number} line number of the printed
   */
  // eslint-disable-next-line no-unused-vars
  printButton(content, accelerator, config) {},
  /**
   * print images that must be declared in csv files in directory res
   * @param {string} names REQUIRED image names
   * @returns {number} line number of the printed
   */
  // eslint-disable-next-line no-unused-vars
  printImage(...names) {},
  /**
   * @param {...ColumnObject|GridObject[]} columnObjects
   * @returns {number} line number of the printed
   * @see drawLine
   * @see print
   * @see printButton
   * @see printImage
   * @see printProgress
   * @see printWholeImage
   */
  // eslint-disable-next-line no-unused-vars
  printInColRows(...columnObjects) {},
  /**
   * print a line chart by chart.js
   * <br/> see: chart.js, chartjs-plugin-annotation, vue-chartjs
   * <br/> note: options.scales.x.ticks.callback and options.scales.y.ticks.callback is the argument array used to create Function
   * @param {*} config
   * @returns {number} line number of the printed
   */
  // eslint-disable-next-line no-unused-vars
  printLineChart(config) {},
  /**
   * print multiple columns into a row, excluding inputs
   * @param {GridObject[]} columnObjects the array of settings of columns, like print, printButton, printImage and printProgress
   * @param {ColumnConfig} [config] config of the row
   * @returns {number} line number of the printed
   * @see drawLine
   * @see print
   * @see printButton
   * @see printImage
   * @see printProgress
   * @see printWholeImage
   */
  // eslint-disable-next-line no-unused-vars
  printMultiColumns(columnObjects, config) {},
  /**
   * print a progress bar
   * @param {number} percentage REQUIRED the percentage of the progress bar, float, 0-100
   * @param {string} inContent REQUIRED the text shown in the progress bar
   * @param {string} outContent REQUIRED the text shown next to the progress bar
   * @param {ProgressConfig} [config] config of the printed progress
   * @returns {number} line number of the printed
   */
  // eslint-disable-next-line no-unused-vars
  printProgress(percentage, inContent, outContent, config) {},
  /**
   * print the whole image
   * @param {string|string[]} names REQUIRED
   * @param {WholeImageConfig} [config]
   * @returns {number} line number of the printed
   */
  // eslint-disable-next-line no-unused-vars
  printWholeImage(names, config) {},
  /**
   * print a line break, if just used to print enter at the end of a line, please use print('*** \n') to replace
   * @returns {number} line number of the printed
   */
  println() {},
  /** DANGER exit the application and close the window */
  quit() {},
  /**
   * DANGER replace the line just printed with a new in-col-row line
   * @param {...ColumnObject|GridObject[]} columnObjects
   * @returns {number} line number of the printed
   */
  // eslint-disable-next-line no-unused-vars
  replaceInColRows(...columnObjects) {},
  /**
   * DANGER replace the line just printed with a new text line
   * @param {TextContent} content REQUIRED the text to be printed
   * @param {TextConfig} [config] config of the printed line
   * @returns {number} line number of the printed
   */
  // eslint-disable-next-line no-unused-vars
  replaceText(content, config) {},
  /**
   * reset the data of a character
   * @param {number | number[]} charaId REQUIRED id of the character defined in chara*.csv
   *     <br>if it is an array, is means reset the character charaId[0] with the data of the character charaId[1]
   * @returns {void}
   */
  // eslint-disable-next-line no-unused-vars
  resetCharacter(...charaId) {},
  /**
   * reset all data of the save
   * @returns {void}
   */
  resetData() {},
  /**
   * reset global variables
   * @returns {Promise<boolean>}
   */
  async resetGlobal() {},
  /** resume the music in playing */
  resumeMusic() {},
  /**
   * remove a data file
   * @param {number} savIndex REQUIRED the index of the save file
   * @returns {Promise<boolean>} if the removing succeeds
   */
  // eslint-disable-next-line no-unused-vars
  async rmData(savIndex) {},
  /**
   * save data into a save file
   * @param {number} savIndex REQUIRED the index of the save file
   * @param {string} [comment] the comment of the save
   * @returns {Promise<boolean>} if the saving succeeds
   */
  // eslint-disable-next-line no-unused-vars
  async saveData(savIndex, comment) {},
  /**
   * save global variables into save file
   * @returns {Promise<boolean>} if the saving succeeds
   */
  async saveGlobal() {},
  /**
   * @template T
   * set a variable by name
   * @param {string} varName REQUIRED the name of variable, String, like 'callname:1:2'
   * @param {T} val REQUIRED the new value of the variable
   * @returns {T} the new value of the variable, or undefined if failed
   */
  // eslint-disable-next-line no-unused-vars
  set(varName, val) {},
  /**
   * set default text-align
   * @param {string} textAlign REQUIRED the text-align, center, left or right used in usual
   * @returns {void}
   */
  // eslint-disable-next-line no-unused-vars
  setAlign(textAlign) {},
  /**
   * set default horizontal align of inColRows
   * @param {string} align REQUIRED the vertical align, start, end, center, space-around, space-between or space-evenly
   * @returns {void}
   */
  // eslint-disable-next-line no-unused-vars
  setHorizontalAlign(align) {},
  /**
   * @param {string} [maskName]
   * @param {number} [opacity]
   */
  // eslint-disable-next-line no-unused-vars
  setMask(maskName, opacity) {},
  /**
   * set default offset
   * @param {number} offset REQUIRED an integer between 0 and 23
   * @returns {void}
   */
  // eslint-disable-next-line no-unused-vars
  setOffset(offset) {},
  /**
   * set the title of the window
   * @param {string} title REQUIRED
   * @returns {void}
   */
  // eslint-disable-next-line no-unused-vars
  setTitle(title) {},
  /**
   * print an empty block and make the following lines shown in the bottom
   * @returns {number} line number of the printed
   */
  setToBottom() {},
  /**
   * set default vertical align of inColRows
   * @param {string} align REQUIRED the vertical align, top, middle or bottom used in usual
   * @returns {void}
   */
  // eslint-disable-next-line no-unused-vars
  setVerticalAlign(align) {},
  /**
   * set default width
   * @param {number} width REQUIRED an integer between 1 and 24
   * @returns {void}
   */
  // eslint-disable-next-line no-unused-vars
  setWidth(width) {},
  /** pause the music in the playing */
  stopMusic() {},
  /**
   * toggle debug status
   * @returns {boolean} if debug
   */
  toggleDebug() {},
  version: { sdk: '4.3.2', engine: undefined },
  /**
   * wait any key from user
   * @returns {Promise<void>} a promise of nothing, please use await
   */
  async waitAnyKey() {},
};

Object.keys(era).forEach((key) => {
  if (era[key] instanceof Function && key !== 'delay') {
    era[key] = (...args) => {
      if (era.version.engine === undefined) {
        return console.log(
          '[ERROR] apis has not been injected!',
          new Error().stack.split('\n').slice(2).join('\n'),
        );
      }
      if (!era[key]._s) {
        return era.logger.error(
          `unsupported api! please check the version of the engine! current version: sdk=${
            era.version.sdk
          }, engine=${era.version.engine}`,
          new Error().stack.split('\n').slice(2).join('\n'),
        );
      }
      return era[key](...args);
    };
  }
});

module.exports = era;
