TODO
====

- [ ] Remove unused code
- [ ] Consider replacing the __DODGY_MOPT_REPLACE_*__ guff with some kind of
      prop on the node
- [ ] (If still using __DODGY_MOPT_REPLACE__...) at the end, check for any
      strays (and bail if found)
- [ ] Replace the `path.replaceWithSourceString` and associated JSON.stringify
      hackery with something that's correct for Babel
- [ ] Figure out a cleaner way to bail on the `tryToHandleComplex` transforms
- [ ] Linting
