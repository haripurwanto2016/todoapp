
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    new Set();

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    // Needs to be written like this to pass the tree-shake-test
    'WeakMap' in globals ? new WeakMap() : undefined;
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    // we need to store the information for multiple documents because a Svelte application could also contain iframes
    // https://github.com/sveltejs/svelte/issues/3624
    new Map();

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const _boolean_attributes = [
        'allowfullscreen',
        'allowpaymentrequest',
        'async',
        'autofocus',
        'autoplay',
        'checked',
        'controls',
        'default',
        'defer',
        'disabled',
        'formnovalidate',
        'hidden',
        'inert',
        'ismap',
        'loop',
        'multiple',
        'muted',
        'nomodule',
        'novalidate',
        'open',
        'playsinline',
        'readonly',
        'required',
        'reversed',
        'selected'
    ];
    /**
     * List of HTML boolean attributes (e.g. `<input disabled>`).
     * Source: https://html.spec.whatwg.org/multipage/indices.html
     */
    new Set([..._boolean_attributes]);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.1' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function dataset_dev(node, property, value) {
        node.dataset[property] = value;
        dispatch_dev('SvelteDOMSetDataset', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\ToDoCard.svelte generated by Svelte v3.59.1 */
    const file$2 = "src\\ToDoCard.svelte";

    // (25:20) {#if listName != 'Girls'}
    function create_if_block_1(ctx) {
    	let span;
    	let i;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			span = element("span");
    			i = element("i");
    			attr_dev(i, "class", "fa fa-chevron-left");
    			add_location(i, file$2, 26, 24, 813);
    			attr_dev(span, "class", "icon has-text-primary");
    			add_location(span, file$2, 25, 20, 725);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, i);

    			if (!mounted) {
    				dispose = listen_dev(span, "click", /*handleMoveLeft*/ ctx[4], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(25:20) {#if listName != 'Girls'}",
    		ctx
    	});

    	return block;
    }

    // (41:20) {#if listName != "Wives"}
    function create_if_block(ctx) {
    	let span;
    	let i;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			span = element("span");
    			i = element("i");
    			attr_dev(i, "class", "fa fa-chevron-right");
    			add_location(i, file$2, 42, 28, 1434);
    			attr_dev(span, "class", "icon has-text-primary");
    			add_location(span, file$2, 41, 24, 1341);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, i);

    			if (!mounted) {
    				dispose = listen_dev(span, "click", /*handleMoveRight*/ ctx[3], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(41:20) {#if listName != \\\"Wives\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div7;
    	let div6;
    	let div5;
    	let div4;
    	let div0;
    	let t0;
    	let div1;
    	let t1;
    	let t2;
    	let div2;
    	let span;
    	let i;
    	let t3;
    	let div3;
    	let mounted;
    	let dispose;
    	let if_block0 = /*listName*/ ctx[1] != 'Girls' && create_if_block_1(ctx);
    	let if_block1 = /*listName*/ ctx[1] != "Wives" && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div7 = element("div");
    			div6 = element("div");
    			div5 = element("div");
    			div4 = element("div");
    			div0 = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			div1 = element("div");
    			t1 = text(/*content*/ ctx[0]);
    			t2 = space();
    			div2 = element("div");
    			span = element("span");
    			i = element("i");
    			t3 = space();
    			div3 = element("div");
    			if (if_block1) if_block1.c();
    			attr_dev(div0, "class", "column is-1");
    			add_location(div0, file$2, 23, 16, 631);
    			attr_dev(div1, "class", "column is-9");
    			add_location(div1, file$2, 31, 16, 947);
    			attr_dev(i, "class", "fa fa-trash");
    			add_location(i, file$2, 35, 24, 1143);
    			attr_dev(span, "class", "icon has-text-danger");
    			add_location(span, file$2, 34, 20, 1082);
    			attr_dev(div2, "class", "column is-1");
    			add_location(div2, file$2, 33, 16, 1007);
    			attr_dev(div3, "class", "column is-1");
    			add_location(div3, file$2, 39, 16, 1243);
    			attr_dev(div4, "class", "columns");
    			add_location(div4, file$2, 22, 12, 592);
    			attr_dev(div5, "class", "card-content");
    			add_location(div5, file$2, 21, 8, 552);
    			attr_dev(div6, "class", "card mb-3 has-background-primary-light");
    			add_location(div6, file$2, 20, 4, 490);
    			add_location(div7, file$2, 19, 0, 479);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div7, anchor);
    			append_dev(div7, div6);
    			append_dev(div6, div5);
    			append_dev(div5, div4);
    			append_dev(div4, div0);
    			if (if_block0) if_block0.m(div0, null);
    			append_dev(div4, t0);
    			append_dev(div4, div1);
    			append_dev(div1, t1);
    			append_dev(div4, t2);
    			append_dev(div4, div2);
    			append_dev(div2, span);
    			append_dev(span, i);
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			if (if_block1) if_block1.m(div3, null);

    			if (!mounted) {
    				dispose = listen_dev(div2, "click", /*handleDeleteCard*/ ctx[2], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*listName*/ ctx[1] != 'Girls') {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					if_block0.m(div0, null);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty & /*content*/ 1) set_data_dev(t1, /*content*/ ctx[0]);

    			if (/*listName*/ ctx[1] != "Wives") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					if_block1.m(div3, null);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ToDoCard', slots, []);
    	let { content, listName, index } = $$props;
    	const dispatch = createEventDispatcher();

    	function handleDeleteCard() {
    		dispatch("deleteCard", { index });
    	}

    	function handleMoveRight() {
    		dispatch("moveRight", { index });
    	}

    	function handleMoveLeft() {
    		dispatch("moveLeft", { index });
    	}

    	$$self.$$.on_mount.push(function () {
    		if (content === undefined && !('content' in $$props || $$self.$$.bound[$$self.$$.props['content']])) {
    			console.warn("<ToDoCard> was created without expected prop 'content'");
    		}

    		if (listName === undefined && !('listName' in $$props || $$self.$$.bound[$$self.$$.props['listName']])) {
    			console.warn("<ToDoCard> was created without expected prop 'listName'");
    		}

    		if (index === undefined && !('index' in $$props || $$self.$$.bound[$$self.$$.props['index']])) {
    			console.warn("<ToDoCard> was created without expected prop 'index'");
    		}
    	});

    	const writable_props = ['content', 'listName', 'index'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ToDoCard> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('content' in $$props) $$invalidate(0, content = $$props.content);
    		if ('listName' in $$props) $$invalidate(1, listName = $$props.listName);
    		if ('index' in $$props) $$invalidate(5, index = $$props.index);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dataset_dev,
    		content,
    		listName,
    		index,
    		dispatch,
    		handleDeleteCard,
    		handleMoveRight,
    		handleMoveLeft
    	});

    	$$self.$inject_state = $$props => {
    		if ('content' in $$props) $$invalidate(0, content = $$props.content);
    		if ('listName' in $$props) $$invalidate(1, listName = $$props.listName);
    		if ('index' in $$props) $$invalidate(5, index = $$props.index);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [content, listName, handleDeleteCard, handleMoveRight, handleMoveLeft, index];
    }

    class ToDoCard extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { content: 0, listName: 1, index: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ToDoCard",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get content() {
    		throw new Error("<ToDoCard>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set content(value) {
    		throw new Error("<ToDoCard>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get listName() {
    		throw new Error("<ToDoCard>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set listName(value) {
    		throw new Error("<ToDoCard>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get index() {
    		throw new Error("<ToDoCard>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set index(value) {
    		throw new Error("<ToDoCard>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\CardList.svelte generated by Svelte v3.59.1 */
    const file$1 = "src\\CardList.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[11] = i;
    	return child_ctx;
    }

    // (35:12) {#each cards as card, index}
    function create_each_block(ctx) {
    	let todocard;
    	let current;

    	todocard = new ToDoCard({
    			props: {
    				content: /*card*/ ctx[9].todo,
    				listName: /*listName*/ ctx[1],
    				index: /*index*/ ctx[11]
    			},
    			$$inline: true
    		});

    	todocard.$on("deleteCard", /*handleDeleteCard*/ ctx[4]);
    	todocard.$on("moveRight", /*handleMoveRight*/ ctx[5]);
    	todocard.$on("moveLeft", /*handleMoveLeft*/ ctx[6]);

    	const block = {
    		c: function create() {
    			create_component(todocard.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(todocard, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const todocard_changes = {};
    			if (dirty & /*cards*/ 1) todocard_changes.content = /*card*/ ctx[9].todo;
    			if (dirty & /*listName*/ 2) todocard_changes.listName = /*listName*/ ctx[1];
    			todocard.$set(todocard_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(todocard.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(todocard.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(todocard, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(35:12) {#each cards as card, index}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div3;
    	let div2;
    	let div0;
    	let p;
    	let t0;
    	let t1;
    	let div1;
    	let t2;
    	let input;
    	let t3;
    	let button;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*cards*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			p = element("p");
    			t0 = text(/*listName*/ ctx[1]);
    			t1 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			input = element("input");
    			t3 = space();
    			button = element("button");
    			button.textContent = "Add girl";
    			attr_dev(p, "class", "card-header-title");
    			add_location(p, file$1, 31, 12, 890);
    			attr_dev(div0, "class", "card-header");
    			add_location(div0, file$1, 30, 8, 851);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "input is-primary mb-1");
    			add_location(input, file$1, 45, 12, 1369);
    			attr_dev(button, "class", "button is-primary");
    			add_location(button, file$1, 50, 12, 1516);
    			attr_dev(div1, "class", "card-content");
    			add_location(div1, file$1, 33, 8, 959);
    			attr_dev(div2, "class", "card has-background-light");
    			add_location(div2, file$1, 29, 4, 802);
    			attr_dev(div3, "class", "column is-4");
    			add_location(div3, file$1, 28, 0, 771);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div2);
    			append_dev(div2, div0);
    			append_dev(div0, p);
    			append_dev(p, t0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div1, null);
    				}
    			}

    			append_dev(div1, t2);
    			append_dev(div1, input);
    			set_input_value(input, /*todo*/ ctx[2]);
    			append_dev(div1, t3);
    			append_dev(div1, button);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[7]),
    					listen_dev(button, "click", /*handleAddCard*/ ctx[3], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*listName*/ 2) set_data_dev(t0, /*listName*/ ctx[1]);

    			if (dirty & /*cards, listName, handleDeleteCard, handleMoveRight, handleMoveLeft*/ 115) {
    				each_value = /*cards*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div1, t2);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (dirty & /*todo*/ 4 && input.value !== /*todo*/ ctx[2]) {
    				set_input_value(input, /*todo*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('CardList', slots, []);
    	let { cards, listName } = $$props;
    	const dispatch = createEventDispatcher();
    	let todo = "";

    	function handleAddCard() {
    		dispatch("addCard", { todo, listName });
    		$$invalidate(2, todo = "");
    	}

    	function handleDeleteCard(event) {
    		let data = event.detail;
    		dispatch("deleteCard", { index: data.index, listName });
    	}

    	function handleMoveRight(event) {
    		let data = event.detail;
    		dispatch("moveRight", { index: data.index, listName });
    	}

    	function handleMoveLeft() {
    		let data = event.detail;
    		dispatch("moveLeft", { index: data.index, listName });
    	}

    	$$self.$$.on_mount.push(function () {
    		if (cards === undefined && !('cards' in $$props || $$self.$$.bound[$$self.$$.props['cards']])) {
    			console.warn("<CardList> was created without expected prop 'cards'");
    		}

    		if (listName === undefined && !('listName' in $$props || $$self.$$.bound[$$self.$$.props['listName']])) {
    			console.warn("<CardList> was created without expected prop 'listName'");
    		}
    	});

    	const writable_props = ['cards', 'listName'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<CardList> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		todo = this.value;
    		$$invalidate(2, todo);
    	}

    	$$self.$$set = $$props => {
    		if ('cards' in $$props) $$invalidate(0, cards = $$props.cards);
    		if ('listName' in $$props) $$invalidate(1, listName = $$props.listName);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		ToDoCard,
    		cards,
    		listName,
    		dispatch,
    		todo,
    		handleAddCard,
    		handleDeleteCard,
    		handleMoveRight,
    		handleMoveLeft
    	});

    	$$self.$inject_state = $$props => {
    		if ('cards' in $$props) $$invalidate(0, cards = $$props.cards);
    		if ('listName' in $$props) $$invalidate(1, listName = $$props.listName);
    		if ('todo' in $$props) $$invalidate(2, todo = $$props.todo);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		cards,
    		listName,
    		todo,
    		handleAddCard,
    		handleDeleteCard,
    		handleMoveRight,
    		handleMoveLeft,
    		input_input_handler
    	];
    }

    class CardList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { cards: 0, listName: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "CardList",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get cards() {
    		throw new Error("<CardList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set cards(value) {
    		throw new Error("<CardList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get listName() {
    		throw new Error("<CardList>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set listName(value) {
    		throw new Error("<CardList>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.59.1 */
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let div1;
    	let h10;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let h11;
    	let t5;
    	let div0;
    	let cardlist0;
    	let t6;
    	let cardlist1;
    	let t7;
    	let cardlist2;
    	let t8;
    	let link0;
    	let link1;
    	let current;

    	cardlist0 = new CardList({
    			props: {
    				cards: /*taskCards*/ ctx[1],
    				listName: "Girls"
    			},
    			$$inline: true
    		});

    	cardlist0.$on("addCard", /*handleEventAddCard*/ ctx[4]);
    	cardlist0.$on("deleteCard", /*handleEventDeleteCard*/ ctx[5]);
    	cardlist0.$on("moveRight", /*handleEventMoveRight*/ ctx[6]);

    	cardlist1 = new CardList({
    			props: {
    				cards: /*inProgressCards*/ ctx[2],
    				listName: "Girlfriends"
    			},
    			$$inline: true
    		});

    	cardlist1.$on("addCard", /*handleEventAddCard*/ ctx[4]);
    	cardlist1.$on("deleteCard", /*handleEventDeleteCard*/ ctx[5]);
    	cardlist1.$on("moveRight", /*handleEventMoveRight*/ ctx[6]);
    	cardlist1.$on("moveLeft", /*handleEventMoveLeft*/ ctx[7]);

    	cardlist2 = new CardList({
    			props: {
    				cards: /*doneCards*/ ctx[3],
    				listName: "Wives"
    			},
    			$$inline: true
    		});

    	cardlist2.$on("addCard", /*handleEventAddCard*/ ctx[4]);
    	cardlist2.$on("deleteCard", /*handleEventDeleteCard*/ ctx[5]);
    	cardlist2.$on("moveLeft", /*handleEventMoveLeft*/ ctx[7]);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			h10 = element("h1");
    			t0 = text("Hello ");
    			t1 = text(/*name*/ ctx[0]);
    			t2 = text("!");
    			t3 = space();
    			h11 = element("h1");
    			h11.textContent = "Select App";
    			t5 = space();
    			div0 = element("div");
    			create_component(cardlist0.$$.fragment);
    			t6 = space();
    			create_component(cardlist1.$$.fragment);
    			t7 = space();
    			create_component(cardlist2.$$.fragment);
    			t8 = space();
    			link0 = element("link");
    			link1 = element("link");
    			add_location(h10, file, 105, 1, 3231);
    			attr_dev(h11, "class", "is-size-2");
    			add_location(h11, file, 106, 1, 3255);
    			attr_dev(div0, "class", "columns");
    			add_location(div0, file, 107, 1, 3294);
    			attr_dev(div1, "class", "container is-fluid");
    			add_location(div1, file, 104, 0, 3197);
    			attr_dev(link0, "rel", "stylesheet");
    			attr_dev(link0, "href", "../build/bulma.min.css");
    			add_location(link0, file, 133, 1, 3918);
    			attr_dev(link1, "rel", "stylesheet");
    			attr_dev(link1, "href", "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.2.1/css/fontawesome.min.css");
    			attr_dev(link1, "integrity", "sha384-QYIZto+st3yW+o8+5OHfT6S482Zsvz2WfOzpFSXMF9zqeLcFV0/wlZpMtyFcZALm");
    			attr_dev(link1, "crossorigin", "anonymous");
    			add_location(link1, file, 134, 1, 3975);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h10);
    			append_dev(h10, t0);
    			append_dev(h10, t1);
    			append_dev(h10, t2);
    			append_dev(div1, t3);
    			append_dev(div1, h11);
    			append_dev(div1, t5);
    			append_dev(div1, div0);
    			mount_component(cardlist0, div0, null);
    			append_dev(div0, t6);
    			mount_component(cardlist1, div0, null);
    			append_dev(div0, t7);
    			mount_component(cardlist2, div0, null);
    			insert_dev(target, t8, anchor);
    			append_dev(document.head, link0);
    			append_dev(document.head, link1);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*name*/ 1) set_data_dev(t1, /*name*/ ctx[0]);
    			const cardlist0_changes = {};
    			if (dirty & /*taskCards*/ 2) cardlist0_changes.cards = /*taskCards*/ ctx[1];
    			cardlist0.$set(cardlist0_changes);
    			const cardlist1_changes = {};
    			if (dirty & /*inProgressCards*/ 4) cardlist1_changes.cards = /*inProgressCards*/ ctx[2];
    			cardlist1.$set(cardlist1_changes);
    			const cardlist2_changes = {};
    			if (dirty & /*doneCards*/ 8) cardlist2_changes.cards = /*doneCards*/ ctx[3];
    			cardlist2.$set(cardlist2_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(cardlist0.$$.fragment, local);
    			transition_in(cardlist1.$$.fragment, local);
    			transition_in(cardlist2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(cardlist0.$$.fragment, local);
    			transition_out(cardlist1.$$.fragment, local);
    			transition_out(cardlist2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(cardlist0);
    			destroy_component(cardlist1);
    			destroy_component(cardlist2);
    			if (detaching) detach_dev(t8);
    			detach_dev(link0);
    			detach_dev(link1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { name } = $$props;
    	let taskCardsLocalStorage = JSON.parse(localStorage.getItem("taskCards"));
    	let inProgressCardsLocalStorage = JSON.parse(localStorage.getItem("inProgressCards"));
    	let doneCardsLocalStorage = JSON.parse(localStorage.getItem("doneCards"));
    	let taskCards = taskCardsLocalStorage ? taskCardsLocalStorage : [];

    	let inProgressCards = inProgressCardsLocalStorage
    	? inProgressCardsLocalStorage
    	: [];

    	let doneCards = doneCardsLocalStorage ? doneCardsLocalStorage : [];

    	function handleEventAddCard(event) {
    		let data = event.detail;

    		if (data.listName == "Girls") {
    			$$invalidate(1, taskCards = [...taskCards, { todo: data.todo }]);
    			localStorage.setItem("taskCards", JSON.stringify(taskCards));
    		} else if (data.listName == "Girlfriends") {
    			$$invalidate(2, inProgressCards = [...inProgressCards, { todo: data.todo }]);
    			localStorage.setItem("inProgressCards", JSON.stringify(inProgressCards));
    		} else {
    			$$invalidate(3, doneCards = [...doneCards, { todo: data.todo }]);
    			localStorage.setItem("doneCards", JSON.stringify(doneCards));
    		}
    	}

    	function handleEventDeleteCard(event) {
    		let data = event.detail;

    		if (data.listName == "Girls") {
    			taskCards.splice(data.index, 1);
    			$$invalidate(1, taskCards);
    			localStorage.setItem("taskCards", JSON.stringify(taskCards));
    		} else if (data.listName == "Girlfriends") {
    			inProgressCards.splice(data.index, 1);
    			$$invalidate(2, inProgressCards);
    			localStorage.setItem("inProgressCards", JSON.stringify(inProgressCards));
    		} else {
    			doneCards.splice(data.index, 1);
    			$$invalidate(3, doneCards);
    			localStorage.setItem("doneCards", JSON.stringify(doneCards));
    		}
    	}

    	function handleEventMoveRight(event) {
    		let data = event.detail;

    		if (data.listName == "Girls") {
    			let cardToMove = taskCards.splice(data.index, 1);
    			$$invalidate(2, inProgressCards = [...inProgressCards, cardToMove[0]]);
    			$$invalidate(1, taskCards);
    			localStorage.setItem("taskCards", JSON.stringify(taskCards));
    			localStorage.setItem("inProgressCards", JSON.stringify(inProgressCards));
    		} else if (data.listName == "Girlfriends") {
    			let cardToMove = inProgressCards.splice(data.index, 1);
    			$$invalidate(3, doneCards = [...doneCards, cardToMove[0]]);
    			$$invalidate(2, inProgressCards);
    			localStorage.setItem("inProgressCards", JSON.stringify(inProgressCards));
    			localStorage.setItem("doneCards", JSON.stringify(doneCards));
    		}
    	}

    	function handleEventMoveLeft(event) {
    		let data = event.detail;

    		if (data.listName == "Girlfriends") {
    			let cardToMove = inProgressCards.splice(data.index, 1);
    			$$invalidate(1, taskCards = [...taskCards, cardToMove[0]]);
    			$$invalidate(2, inProgressCards);
    			localStorage.setItem("taskCards", JSON.stringify(taskCards));
    			localStorage.setItem("inProgressCards", JSON.stringify(inProgressCards));
    		} else if (data.listName == "Wives") {
    			let cardToMove = doneCards.splice(data.index, 1);
    			$$invalidate(2, inProgressCards = [...inProgressCards, cardToMove[0]]);
    			$$invalidate(3, doneCards);
    			localStorage.setItem("inProgressCards", JSON.stringify(inProgressCards));
    			localStorage.setItem("doneCards", JSON.stringify(doneCards));
    		}
    	}

    	$$self.$$.on_mount.push(function () {
    		if (name === undefined && !('name' in $$props || $$self.$$.bound[$$self.$$.props['name']])) {
    			console.warn("<App> was created without expected prop 'name'");
    		}
    	});

    	const writable_props = ['name'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({
    		CardList,
    		name,
    		taskCardsLocalStorage,
    		inProgressCardsLocalStorage,
    		doneCardsLocalStorage,
    		taskCards,
    		inProgressCards,
    		doneCards,
    		handleEventAddCard,
    		handleEventDeleteCard,
    		handleEventMoveRight,
    		handleEventMoveLeft
    	});

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('taskCardsLocalStorage' in $$props) taskCardsLocalStorage = $$props.taskCardsLocalStorage;
    		if ('inProgressCardsLocalStorage' in $$props) inProgressCardsLocalStorage = $$props.inProgressCardsLocalStorage;
    		if ('doneCardsLocalStorage' in $$props) doneCardsLocalStorage = $$props.doneCardsLocalStorage;
    		if ('taskCards' in $$props) $$invalidate(1, taskCards = $$props.taskCards);
    		if ('inProgressCards' in $$props) $$invalidate(2, inProgressCards = $$props.inProgressCards);
    		if ('doneCards' in $$props) $$invalidate(3, doneCards = $$props.doneCards);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		name,
    		taskCards,
    		inProgressCards,
    		doneCards,
    		handleEventAddCard,
    		handleEventDeleteCard,
    		handleEventMoveRight,
    		handleEventMoveLeft
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'Hari The Pianist'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
