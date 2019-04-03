import * as neovim from "neovim";
const socket = process.env.NVIM_LISTEN_ADDRESS;
const nvim = neovim.attach({ socket: socket });

nvim.windows.then(console.log.bind(console));
