import { encodeEntities, styleObjToCss, assign, getChildren } from './util';
import { options, Fragment } from 'preact';
import stream from 'stream';

// components without names, kept as a hash for later comparison to return consistent UnnamedComponentXX names.
const UNNAMED = [];

const VOID_ELEMENTS = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;


function PreactReadableStream(vnode, context, opts) {
	if (opts && opts.pretty) {
		throw new Error('pretty is not supported in renderToNodeStream!');
	}

	stream.Readable.call(this, opts && opts.readable);

	this.vnode = vnode;
	this.context = context || {};
	this.opts = opts || {};
}

PreactReadableStream.prototype = new stream.Readable();
PreactReadableStream.prototype.constructor = PreactReadableStream;
PreactReadableStream.prototype._read = function _read() {
	try {
		if (!this._generator) {
			this._generator = this._generate(this.vnode, this.context, this.opts);
		}
		else if (this.reading) {
			console.warn(new Error('You should not call PreactReadableStream#_read when a read is in progress').stack);
		}

		this.reading = true;

		for (const chunk of this._generator) {
			if (!this.push(chunk)) {
				this.reading = false;
				// high water mark reached, pause the stream until _read is called again...
				return;
			}
		}
	}
	catch (e) {
		this.emit('error', e);
		this.push(null);
		return;
	}

	// end the stream
	this.push(null);
};

PreactReadableStream.prototype._generate = function *_generate(vnode, context, opts, inner, isSvgMode, selectValue) {
	if (vnode==null || typeof vnode==='boolean') {
		yield '';
		return;
	}

	let nodeName = vnode.type,
		props = vnode.props,
		isComponent = false;
	context = context || {};
	opts = opts || {};

	// #text nodes
	if (typeof vnode!=='object' && !nodeName) {
		yield encodeEntities(vnode);
		return;
	}

	// components
	if (typeof nodeName==='function') {
		isComponent = true;
		if (opts.shallow && (inner || opts.renderRootComponent===false)) {
			nodeName = getComponentName(nodeName);
		}
		else if (nodeName===Fragment) {
			let children = [];
			getChildren(children, vnode.props.children);

			for (let i = 0; i < children.length; i++) {
				for (const chunk of this._generate(children[i], context, opts, opts.shallowHighOrder!==false, isSvgMode, selectValue)) {
					yield chunk;
				}
			}

			return;
		}
		else {
			let c = vnode.__c = { __v: vnode, context, props: vnode.props };
			if (options.render) options.render(vnode);

			let renderedVNode;

			if (!nodeName.prototype || typeof nodeName.prototype.render!=='function') {
				// Necessary for createContext api. Setting this property will pass
				// the context value as `this.context` just for this component.
				let cxType = nodeName.contextType;
				let provider = cxType && context[cxType.__c];
				let cctx = cxType != null ? (provider ? provider.props.value : cxType._defaultValue) : context;

				// stateless functional components
				renderedVNode = nodeName.call(vnode.__c, props, cctx);
			}
			else {
				// class-based components
				// c = new nodeName(props, context);
				c = vnode.__c = new nodeName(props, context);
				c.__v = vnode;
				// turn off stateful re-rendering:
				c._dirty = c.__d = true;
				c.props = props;
				c.context = context;
				if (nodeName.getDerivedStateFromProps) c.state = assign(assign({}, c.state), nodeName.getDerivedStateFromProps(c.props, c.state));
				else if (c.componentWillMount) c.componentWillMount();

				renderedVNode = c.render(c.props, c.state || {}, c.context);
			}

			if (c.getChildContext) {
				context = assign(assign({}, context), c.getChildContext());
			}

			for (const chunk of this._generate(renderedVNode, context, opts, opts.shallowHighOrder!==false, isSvgMode, selectValue)) {
				yield chunk;
			}

			return;
		}
	}

	// render JSX to HTML
	let s = '', html;

	if (props) {
		let attrs = Object.keys(props);

		// allow sorting lexicographically for more determinism (useful for tests, such as via preact-jsx-chai)
		if (opts && opts.sortAttributes===true) attrs.sort();

		for (let i=0; i<attrs.length; i++) {
			let name = attrs[i],
				v = props[name];
			if (name==='children') continue;

			if (name.match(/[\s\n\\/='"\0<>]/)) continue;

			if (!(opts && opts.allAttributes) && (name==='key' || name==='ref')) continue;

			if (name==='className') {
				if (props.class) continue;
				name = 'class';
			}
			else if (isSvgMode && name.match(/^xlink:?./)) {
				name = name.toLowerCase().replace(/^xlink:?/, 'xlink:');
			}

			if (name==='style' && v && typeof v==='object') {
				v = styleObjToCss(v);
			}

			let hooked = opts.attributeHook && opts.attributeHook(name, v, context, opts, isComponent);
			if (hooked || hooked==='') {
				s += hooked;
				continue;
			}

			if (name==='dangerouslySetInnerHTML') {
				html = v && v.__html;
			}
			else if ((v || v===0 || v==='') && typeof v!=='function') {
				if (v===true || v==='') {
					v = name;
					// in non-xml mode, allow boolean attributes
					if (!opts || !opts.xml) {
						s += ' ' + name;
						continue;
					}
				}

				if (name==='value') {
					if (nodeName==='select') {
						selectValue = v;
						continue;
					}
					else if (nodeName==='option' && selectValue==v) {
						s += ` selected`;
					}
				}
				s += ` ${name}="${encodeEntities(v)}"`;
			}
		}
	}

	let isVoid = String(nodeName).match(VOID_ELEMENTS);

	s = `<${nodeName}${s}`;
	if (String(nodeName).match(/[\s\n\\/='"\0<>]/)) throw s;

	yield s;

	if (html) {
		yield `>${html}</${nodeName}>`;
		return;
	}

	let didCloseOpeningTag = false;

	let children = [];
	if (props && getChildren(children, props.children).length) {
		for (let i=0; i<children.length; i++) {
			let child = children[i];
			if (child!=null && child!==false) {
				let childSvgMode = nodeName==='svg' ? true : nodeName==='foreignObject' ? false : isSvgMode;
				
				for (const chunk of this._generate(child, context, opts, true, childSvgMode, selectValue)) {
					if (chunk) {
						if (!didCloseOpeningTag) {
							didCloseOpeningTag = true;
							yield '>';
						}
						
						yield chunk;
					}
				}
			}
		}
	}

	yield didCloseOpeningTag
		? `</${nodeName}>`
		: `${isVoid || opts.xml ? '/>' : `></${nodeName}>`}`;
};

function getComponentName(component) {
	return component.displayName || component!==Function && component.name || getFallbackComponentName(component);
}

function getFallbackComponentName(component) {
	let str = Function.prototype.toString.call(component),
		name = (str.match(/^\s*function\s+([^( ]+)/) || '')[1];
	if (!name) {
		// search for an existing indexed name for the given component:
		let index = -1;
		for (let i=UNNAMED.length; i--; ) {
			if (UNNAMED[i]===component) {
				index = i;
				break;
			}
		}
		// not found, create a new indexed name:
		if (index<0) {
			index = UNNAMED.push(component) - 1;
		}
		name = `UnnamedComponent${index}`;
	}
	return name;
}


export default function renderToNodeStream(vnode, context, opts) {
	return new PreactReadableStream(vnode, context, opts);
}
