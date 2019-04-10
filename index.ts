import { Buffer, Window, NvimPlugin } from "neovim";
import { VimValue } from "neovim/lib/types/VimValue";

const labelChars = "jkfdls;aghnvmcieurwo,xz.qpJKFDLS:AGHNVMCIEURWO<XZ>QP";

const minChar = 2;

const transform = <T>(transformer: (source: VimValue) => T) => (promise: Promise<VimValue>): Promise<T> =>
    promise.then(value => transformer(value));

const toString = transform(String);

const toNumber = transform(Number);

type Coordinate = [number, number];

interface Hit {
    offset: Coordinate;
    position: Coordinate;
}

export default (plugin: NvimPlugin) => {
    const { nvim } = plugin;

    const getChar = () => toString(nvim.eval("nr2char(getchar())"));

    const createLabel = async (row: number, col: number, label: string): Promise<Window> => {
        const buffer = (await nvim.createBuffer(false, false)) as Buffer;
        await buffer.setLines(label, { start: 0, end: -1, strictIndexing: true });
        const window = (await nvim.openWindow(buffer, false, {
            relative: "cursor",
            row,
            col,
            width: label.length,
            height: 1,
            focusable: false
        })) as Window;
        await Promise.all([
            window.setOption("number", false),
            window.setOption("relativenumber", false),
            window.setOption("signcolumn", "no"),
            window.setOption("winhl", "Normal:NotionLabel")
        ]);
        return window;
    };

    const indexesOf = (text: string, pattern: RegExp, prev: number[] = []): number[] => {
        const result = pattern.exec(text);
        return result ? indexesOf(text, pattern, [...prev, result.index]) : prev;
    };

    const search = async (query: string): Promise<Hit[]> => {
        const [rowOffset, columnOffset, windowColumn, windowWidth, windowOffset, start, end] = await Promise.all(
            [
                nvim.eval("line('.') - 1"),
                nvim.eval("col('.') - 1"),
                nvim.eval("wincol()"),
                nvim.eval("winwidth(0)"),
                nvim.eval("((&number||&relativenumber)?&numberwidth:0)-&foldcolumn+(&signcolumn=='yes'?2:0)"),
                nvim.eval('line("w0") - 1'),
                nvim.eval('line("w$")')
            ].map(toNumber)
        );
        const lines = await nvim.buffer.getLines({ start, end, strictIndexing: true });
        const hasUpperCase = query.toLowerCase() != query;
        const queryPattern = new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");

        const getPositionsOfMatches = (prev: Coordinate[], line: string, row: number) => [
            ...prev,
            ...indexesOf(hasUpperCase ? line : line.toLowerCase(), queryPattern).map((index): Coordinate => [row + start, index])
        ];
        const omitCurrentPosition = ([row, column]: Coordinate) => row !== rowOffset || column !== columnOffset;
        const omitOutsideOfViewport = ({ offset: [_, column] }: Hit) =>
            windowOffset - windowColumn < column && column <= windowWidth - windowColumn;
        const sortByDistanceFromCursor = (a: Hit, b: Hit) => Math.abs(a.offset[0]) - Math.abs(b.offset[0]);
        const transformPositionToHit = ([row, column]: Coordinate): Hit => ({
            position: [row + 1, column],
            offset: [row - rowOffset, column - columnOffset]
        });

        return lines
            .reduce(getPositionsOfMatches, [])
            .filter(omitCurrentPosition)
            .map(transformPositionToHit)
            .filter(omitOutsideOfViewport)
            .sort(sortByDistanceFromCursor);
    };

    const getHits = async (prev: string = ""): Promise<Hit[]> => {
        const query = prev + (await getChar());
        await nvim.outWrite("> " + query + "\n");
        const hits = await search(query);
        return query.length >= minChar || hits.length < 2 ? hits : getHits(query);
    };

    const getJumpTarget = async (hits: Hit[]): Promise<Hit> => {
        if (hits.length <= 1) {
            return hits[0];
        }
        const labels = await Promise.all(hits.map(({ offset: [row, column] }, index) => createLabel(row, column, labelChars[index])));
        const target = hits[labelChars.indexOf(await getChar())];
        labels.forEach(label => label.close());
        return target;
    };

    const execute = async () => {
        const target = await getJumpTarget(await getHits());
        if (target) {
            nvim.window.cursor = target.position;
        } else {
            await nvim.outWrite("No jump target!\n");
        }
    };

    plugin.setOptions({ dev: true });

    plugin.registerCommand("NotionJump", execute, { sync: false });
};
