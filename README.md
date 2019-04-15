Notion
======

Notion allows you to quickly jump to any word within the current viewport. It was build to be a minimalist alternative to [EasyMotion](https://github.com/Lokaltog/vim-easymotion), that avoids most of its hacks by using neovim's upcoming floating window feature. It is therefore only possible to use notion with neovim master until version 4.0 is released.

Usage
-----

1. Execute `:NotionJump`
2. Type in the first two characters of the target word
3. Choose a jump target by hitting the corresponding key


![Usage](https://raw.githubusercontent.com/tbo/notion/master/screencapture.gif)

Install
-------

Prerequisites: [Node.Js](https://nodejs.org/en/) + [Node Plugin Host](https://github.com/neovim/node-client)

- [vim-plug](https://github.com/junegunn/vim-plug)
  - `Plug 'tbo/notion'`
- [Pathogen](https://github.com/tpope/vim-pathogen)
  - `git clone git://github.com/tbo/notion.git ~/.vim/bundle/notion`
- Manual installation:
  - Copy the files to your `.vim` directory.

Register the plugin with `:UpdateRemotePlugins`

Example Configuration
---------------------
```viml
" vim-plug boilerplate
call plug#begin('~/.vim/plugged')
Plug 'tbo/notion'
call plug#end()

" Don't delete hidden buffers
set hidden
" Do not wrap lines
set nowrap

hi NotionLabel guifg=red guibg=black ctermfg=red ctermbg=black

nmap <silent> c :NotionJump<CR>
```

Known Issues & Limitations
--------------------------

- Does not work in combination with `wrap` (yet)
- The amount of jump targets is limited to 65
- Labels are incorrectly displayed if the buffer is scrolled horizontally, because of [#9857](https://github.com/neovim/neovim/issues/9857)
