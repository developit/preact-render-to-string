import { render } from '../src';
import {h, Component} from 'preact';
import chai, { expect } from 'chai';
import { spy, match } from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(sinonChai);

describe('mixedRender()', () => {
	it('should not render nested components when not white listed', () => {
		let Test = spy(({ foo, children }) => <div bar={foo}><b>test child</b>{children}</div>);
		Test.displayName = 'Test';

		let rendered = render(
			<section>
				<Test foo={1}><span>asdf</span></Test>
			</section>
			, {}, { shallow: true, alwaysRenderedComponents: [] });

		expect(rendered).to.equal(`<section><Test foo="1"><span>asdf</span></Test></section>`);
		expect(Test).not.to.have.been.called;
	});

	it('should always render root component', () => {
		let Test = spy(({ foo, children }) => <div bar={foo}><b>test child</b>{children}</div>);
		Test.displayName = 'Test';

		let rendered = render(
			<Test foo={1}>
				<span>asdf</span>
			</Test>
			, {}, { shallow: true, alwaysRenderedComponents: [] });

		expect(rendered).to.equal(`<div bar="1"><b>test child</b><span>asdf</span></div>`);
		expect(Test).to.have.been.calledOnce;
	});

	it('should render nested components when they are white listed', () => {
		let Test = spy(({ foo, children }) => <div bar={foo}><b>test child</b>{children}</div>);
		Test.displayName = 'Test';

		let rendered = render(
			<section>
				<Test foo={1}><span>asdf</span></Test>
			</section>
			, undefined, { alwaysRenderedComponents: ['Test'] });

		expect(rendered).to.equal(`<section><div bar="1"><b>test child</b><span>asdf</span></div></section>`);
		expect(Test).to.have.been.called;
	});

	it('should not render nested components inside a whitelisted component', () => {
		let Test = spy(({ foo, children }) => <div bar={foo}><b>test child</b>{children}</div>);
		let Ignored = spy(({ title, children }) => <h2>This {title} should not be rendered</h2>);
		Test.displayName = 'Test';
		Ignored.displayName = 'Ignored';

		let rendered = render(
			<section>
				<Test foo={1}><Ignored title={'FooBarTitle'}/></Test>
			</section>
			, {}, { shallow: true, alwaysRenderedComponents: ['Test'] });

		expect(rendered).to.equal(`<section><div bar="1"><b>test child</b><Ignored title="FooBarTitle"></Ignored></div></section>`);
		expect(Test).to.have.been.called;
		expect(Ignored).to.not.have.been.called;
	});

	it('should render deeply nested components when all are white listed', () => {
		let Test = spy(({ foo, children }) => <div bar={foo}><b>test child</b>{children}</div>);
		let Ignored = spy(({ title, children }) => <h2>This {title} should be rendered</h2>);
		Test.displayName = 'Test';
		Ignored.displayName = 'Ignored';

		let rendered = render(
			<section>
				<Test foo={1}><Ignored title={'FooBarTitle'}/></Test>
			</section>
			, {}, { shallow: true, alwaysRenderedComponents: ['Test', 'Ignored'] });

		expect(rendered).to.equal(`<section><div bar="1"><b>test child</b><h2>This FooBarTitle should be rendered</h2></div></section>`);
		expect(Test).to.have.been.called;
		expect(Ignored).to.have.been.called;
	});
});
