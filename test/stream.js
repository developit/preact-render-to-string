import renderToNodeStream from '../src/stream';
import { h, Component } from 'preact';
import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
chai.use(sinonChai);

describe('stream.render', () => {
	describe('Basic JSX', () => {
		it('should render JSX', () => {
			let stream = renderToNodeStream(<div class="foo">bar</div>),
				expectedParts = ['<div class="foo"','>','bar','</div>'],
				expected = expectedParts.join('');

			return new Promise((resolve, reject) => {
				let chunks = [];
				stream.on('data', (chunk) => {
					chunks.push(chunk);
				});
				stream.on('end', () => {
					const parts = chunks.map(c => c.toString('utf8'));
					const final = Buffer.concat(chunks).toString('utf8');

					expect(final).to.equal(expected);
					expect(parts).to.deep.equal(expectedParts);

					resolve();
				});
				stream.on('error', reject);
			});
		});

		it('should render components', () => {
			function FuncComp(props) {
				return (
					<article>
						<h1>Hello Functional</h1>
						<p>More content</p>
						{props.children}
					</article>
				);
			}

			class ClassComp extends Component {
				render(props) {
					return (
						<article>
							<h1>Hello Class</h1>
							<p>Even more</p>
							{props.children}
						</article>
					);
				}
			}

			let stream = renderToNodeStream(
					<section>
						<FuncComp>
							<p>With children</p>
						</FuncComp>
						<ClassComp>
							<p>Also with children</p>
						</ClassComp>
					</section>
				),
				expectedParts = [
					'<section', '>',
					'<article', '>',
					'<h1', '>',
					'Hello Functional',
					'</h1>',
					'<p', '>',
					'More content',
					'</p>',
					'<p', '>',
					'With children',
					'</p>',
					'</article>',
					'<article', '>',
					'<h1', '>',
					'Hello Class',
					'</h1>',
					'<p', '>',
					'Even more',
					'</p>',
					'<p', '>',
					'Also with children',
					'</p>',
					'</article>',
					'</section>'
				],
				expected = expectedParts.join('');

			return new Promise((resolve, reject) => {
				let chunks = [];
				stream.on('data', (chunk) => {
					chunks.push(chunk);
				});
				stream.on('end', () => {
					const parts = chunks.map(c => c.toString('utf8'));
					const final = Buffer.concat(chunks).toString('utf8');

					expect(parts).to.deep.equal(expectedParts);
					expect(final).to.equal(expected);

					resolve();
				});
				stream.on('error', reject);
			});
		});

		it('should handle backpressure', () => {
			const highWaterMark = 64;
			let stream = renderToNodeStream(
				<section>
					{[...Array(20)].map(() => <div />)}
				</section>,
				undefined,
				{
					readable: {
						highWaterMark
					}
				}
			);

			return new Promise((res, rej) => {
				stream.read();
				setTimeout(() => {
					expect(stream._readableState.length).to.be.lessThan(highWaterMark + 1);
					res();
				}, 100);
				stream.on('error', (e) => {
					console.error('Stream emitted error:', e);
					rej(e);
				});
				stream.on('end', () => {
					rej('Didn\'t expect stream to end as highWaterMark should be reached...');
				});
			});
		});

		it('should support pausing', () => {
			let stream = renderToNodeStream(
				<section>
					{[...Array(20)].map(() => <div />)}
				</section>
			);

			return new Promise((res, rej) => {
				let chunks = [];
				stream.on('error', (e) => {
					console.error('Stream emitted error:', e);
					rej(e);
				});
				stream.on('data', (chunk) => {
					chunks.push(chunk);
					if (chunks.length === 10) {
						stream.pause();
						setTimeout(() => {
							expect(chunks.length).to.equal(10);
							res();
						}, 100);
					}
				});
				stream.on('end', () => {
					rej('Didn\'t expect stream to end, as it should be paused!');
				});
			});
		});
	});
});
