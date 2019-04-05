import * as neovim from "neovim";
import { VimValue } from "neovim/lib/types/VimValue";

const labelChars = "jkfdls;aghnvmcieurwo,xz.qpJKFDLS:AGHNVMCIEURWO<XZ>QP";

const minChar = 2;

const nvim = neovim.attach({ socket: process.env.NVIM_LISTEN_ADDRESS });

const toString = (promise: Promise<VimValue>): Promise<string> => promise.then(value => String(value));

const toNumber = (promise: Promise<VimValue>): Promise<number> => promise.then(value => Number(value));

const getChar = () => toString(nvim.eval("nr2char(getchar())"));

const createLabel = async (row: number, col: number, label: string): Promise<neovim.Window> => {
    const buffer = (await nvim.createBuffer(false, false)) as neovim.Buffer;
    await buffer.setLines(label, { start: 0, end: -1, strictIndexing: true });
    const window = (await nvim.openWindow(buffer, false, {
        relative: "cursor",
        row,
        col,
        width: label.length,
        height: 1,
        focusable: false
    })) as neovim.Window;
    await window.setOption("number", false);
    await window.setOption("relativenumber", false);
    await window.setOption("signcolumn", "no");
    await window.setOption("winhl", "Normal:NotionLabel");
    return window;
};

interface Hit {
    offset: [number, number];
    position: [number, number];
}

const indexesOf = (text: string, searchString: string, prev: number[] = []): number[] => {
    const index = text.indexOf(searchString, prev.slice(-1)[0] + 1);
    return index === -1 ? prev : indexesOf(text, searchString, [...prev, index]);
};

const search = async (query: string): Promise<Hit[]> => {
    const [_, cursorRow, cursorColumn] = (await nvim.eval("getcurpos()")) as string[];
    const hasUpperCase = query.toLowerCase() != query;
    const rowOffset = Number(cursorRow) - 1;
    const columnOffset = Number(cursorColumn) - 1;
    const start = await toNumber(nvim.eval('line("w0") - 1'));
    const end = await toNumber(nvim.eval('line("w$")'));
    const lines = await nvim.buffer.getLines({ start, end, strictIndexing: true });
    return lines
        .reduce(
            (prev: [number, number][], line, row) =>
                prev.concat(
                    indexesOf(hasUpperCase ? line : line.toLowerCase(), query).map((index): [number, number] => [row + start, index])
                ),
            []
        )
        .map(([row, column]): Hit => ({ position: [row + 1, column], offset: [row - rowOffset, column - columnOffset] }))
        .sort((a, b) => Math.abs(a.offset[0]) - Math.abs(b.offset[0]));
};

const execute = async () => {
    let query = "";
    let hits;
    do {
        query += await getChar();
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
nvim.windows.then(execute);
