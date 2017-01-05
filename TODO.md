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
- [ ] m.fragment
- [ ] Could consider unsafe transforms (via flags?)
      * [ ] Pick up intelligible like `m('div', vnode.attrs)` as an obj,
            or `m('div', vnode.children)`
      * [ ] Inject more "globals", eg `classNames` (might not be useful?)
      * [x] Is there a way to support components? eg `m(AssumeComponent, ...)`
            - [ ] Is it safe?
      * [ ] Object.assign
      * [ ] Object.keys
      * [ ] More AST awareness and hence support more identier ooccurences
            - Make the tests match stress that more
