"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const labelChars = "jkfdls;aghnvmcieurwo,xz.qpJKFDLS:AGHNVMCIEURWO<XZ>QP";
const minChar = 2;
const toString = (promise) => promise.then(value => String(value));
const toNumber = (promise) => promise.then(value => Number(value));
exports.default = (plugin) => {
    const { nvim } = plugin;
    const getChar = () => toString(nvim.eval("nr2char(getchar())"));
    const createLabel = async (row, col, label) => {
        const buffer = (await nvim.createBuffer(false, false));
        await buffer.setLines(label, { start: 0, end: -1, strictIndexing: true });
        const window = (await nvim.openWindow(buffer, false, {
            relative: "cursor",
            row,
            col,
            width: label.length,
            height: 1,
            focusable: false
        }));
        await window.setOption("number", false);
        await window.setOption("relativenumber", false);
        await window.setOption("signcolumn", "no");
        await window.setOption("winhl", "Normal:NotionLabel");
        return window;
    };
    const indexesOf = (text, pattern, prev = []) => {
        const result = pattern.exec(text);
        return result ? indexesOf(text, pattern, [...prev, result.index]) : prev;
    };
    const search = async (query) => {
        const [_, cursorRow, cursorColumn] = (await nvim.eval("getcurpos()"));
        const hasUpperCase = query.toLowerCase() != query;
        const rowOffset = Number(cursorRow) - 1;
        const columnOffset = Number(cursorColumn) - 1;
        const windowColumn = await toNumber(nvim.eval("wincol()"));
        const windowWidth = await toNumber(nvim.eval("winwidth(0)"));
        const windowOffset = await toNumber(nvim.eval("((&number||&relativenumber)?&numberwidth:0)-&foldcolumn+(&signcolumn=='yes'?2:0)"));
        const start = await toNumber(nvim.eval('line("w0") - 1'));
        const end = await toNumber(nvim.eval('line("w$")'));
        const lines = await nvim.buffer.getLines({ start, end, strictIndexing: true });
        const queryPattern = new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
        return lines
            .reduce((prev, line, row) => prev.concat(indexesOf(hasUpperCase ? line : line.toLowerCase(), queryPattern).map((index) => [row + start, index])), [])
            .filter(([row, column]) => rowOffset !== row || column !== columnOffset)
            .map(([row, column]) => ({ position: [row + 1, column], offset: [row - rowOffset, column - columnOffset] }))
            .filter(({ offset: [_, column] }) => windowOffset - windowColumn < column && column <= windowWidth - windowColumn)
            .sort((a, b) => Math.abs(a.offset[0]) - Math.abs(b.offset[0]));
    };
    const execute = async () => {
        let query = "";
        let hits;
        do {
            query += await getChar();
            await nvim.outWrite("> " + query + "\n");
            hits = await search(query);
            switch (hits.length) {
                case 0:
                    return await nvim.outWrite("no hits!\n");
                case 1:
                    return (nvim.window.cursor = hits[0].position);
            }
        } while (query.length < minChar);
        const labels = await Promise.all(hits.map(({ offset: [row, column] }, index) => createLabel(row, column, labelChars[index])));
        const target = hits[labelChars.indexOf(await getChar())];
        if (target) {
            nvim.window.cursor = target.position;
        }
        labels.forEach(label => label.close());
    };
    plugin.setOptions({ dev: true });
    plugin.registerCommand("NotionJump", execute, { sync: false });
};
