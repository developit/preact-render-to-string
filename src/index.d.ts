import { VNode } from 'preact';

declare module render {
  interface Options {
    shallow:boolean;
    xml:boolean;
    pretty:boolean;
    alwaysRenderedComponents: Array[String];
  }

  function render(vnode:VNode, context?:any, options?:Options):string;
  function shallowRender(vnode:VNode, context?:any):string;
}

export = render;
