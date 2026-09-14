import test from "node:test";
import assert from "node:assert/strict";

// Since parser.ts is TypeScript, we can compile or import the built main.js or test a standalone ESM build.
// Alternatively, we can test via esbuild dynamic import or tsx / node loader.
// Let's use esbuild to build parser into memory or import esbuild-bundled parser.
import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const parserTsPath = path.resolve(__dirname, "../src/parser.ts");

// Bundle parser.ts to ESM in memory
const buildResult = await esbuild.build({
	entryPoints: [parserTsPath],
	bundle: true,
	write: false,
	format: "esm",
	target: "node18",
});

const code = buildResult.outputFiles[0].text;
const dataUri = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const {
	extractURL,
	extractTitle,
	extractImages,
	extractVideoUrl,
	extractContent,
	isVideoNote,
	extractTags,
	sanitizeFilename,
} = await import(dataUri);

test("extractURL matches xhslink.cn short links", () => {
	assert.equal(
		extractURL("https://xhslink.cn/o/9hocmhutQ15"),
		"https://xhslink.cn/o/9hocmhutQ15"
	);
	assert.equal(
		extractURL("http://xhslink.cn/o/2WbYk12a1h4"),
		"http://xhslink.cn/o/2WbYk12a1h4"
	);
});

test("extractURL matches xhslink.cn embedded in Chinese share text", () => {
	const shareText = "✨水钻一字带露趾高跟凉鞋｜宴会C位神器 ✨水钻一字带... https://xhslink.cn/o/9hocmhutQ15 \n复制一下，跳转【小红书】即刻浏览笔记。";
	assert.equal(
		extractURL(shareText),
		"https://xhslink.cn/o/9hocmhutQ15"
	);

	const punctuated = "✨ 爆款笔记推荐：https://xhslink.cn/o/2WbYk12a1h4，赶快收藏！";
	assert.equal(
		extractURL(punctuated),
		"https://xhslink.cn/o/2WbYk12a1h4"
	);
});

test("extractURL matches xhslink.com and xhs.cn short links", () => {
	assert.equal(
		extractURL("http://xhslink.com/o/1fRz2qqwhkI"),
		"http://xhslink.com/o/1fRz2qqwhkI"
	);
	assert.equal(
		extractURL("https://xhslink.com/a/abc123xyz"),
		"https://xhslink.com/a/abc123xyz"
	);
	assert.equal(
		extractURL("http://xhs.cn/test123"),
		"http://xhs.cn/test123"
	);
});

test("extractURL prepends https to protocol-less short links", () => {
	assert.equal(
		extractURL("xhslink.cn/o/2WbYk12a1h4"),
		"https://xhslink.cn/o/2WbYk12a1h4"
	);
});

test("extractURL preserves explore URLs and query parameters (xsec_token)", () => {
	const url = "https://www.xiaohongshu.com/explore/6a7575140000000032033f8f?xsec_token=ABHcv123=&xsec_source=pc_feed";
	assert.equal(extractURL(url), url);

	const rednoteUrl = "https://www.rednote.com/explore/6a7575140000000032033f8f?xsec_token=ABHcv123=&xsec_source=pc_feed";
	assert.equal(extractURL(rednoteUrl), rednoteUrl);
});

test("extractURL normalizes legacy discovery/item URLs to explore", () => {
	const legacyXhs = "https://www.xiaohongshu.com/discovery/item/6a7575140000000032033f8f?xsec_token=ABHcv123=";
	assert.equal(
		extractURL(legacyXhs),
		"https://www.xiaohongshu.com/explore/6a7575140000000032033f8f?xsec_token=ABHcv123="
	);

	const legacyRednote = "https://www.rednote.com/discovery/item/6a7575140000000032033f8f";
	assert.equal(
		extractURL(legacyRednote),
		"https://www.rednote.com/explore/6a7575140000000032033f8f"
	);
});

test("extractURL normalizes user profile note URLs to explore", () => {
	const profileUrl = "https://www.xiaohongshu.com/user/profile/5b987654321/6a7575140000000032033f8f?xsec_token=test";
	assert.equal(
		extractURL(profileUrl),
		"https://www.xiaohongshu.com/explore/6a7575140000000032033f8f?xsec_token=test"
	);
});

test("extractURL returns null for non-matching text", () => {
	assert.equal(extractURL(""), null);
	assert.equal(extractURL("https://example.com/page/123"), null);
	assert.equal(extractURL("Hello world without links"), null);
});

test("extractTitle prefers state note.title and strips hashtags and branding", () => {
	const state = {
		note: {
			noteDetailMap: {
				"6a7575": {
					note: {
						title: "我的精彩笔记 #生活记录# #旅行",
						desc: "描述内容"
					}
				}
			}
		}
	};
	const html = `<html><head><title>Fallback Title - 小红书</title></head><body><script>window.__INITIAL_STATE__ = ${JSON.stringify(state)};</script></body></html>`;
	assert.equal(extractTitle(html), "我的精彩笔记");
});

test("extractTitle falls back when title is generic rednote", () => {
	const state = {
		note: {
			noteDetailMap: {
				"6a7575": {
					note: {
						title: "",
						desc: "这是笔记的第一行描述\n第二行"
					}
				}
			}
		}
	};
	const html = `<html><head><title>rednote</title></head><body><script>window.__INITIAL_STATE__ = ${JSON.stringify(state)};</script></body></html>`;
	assert.equal(extractTitle(html), "这是笔记的第一行描述");
});

test("extractImages safely retrieves image URLs", () => {
	const state = {
		note: {
			noteDetailMap: {
				"6a7575": {
					note: {
						imageList: [
							{ urlDefault: "http://sns-webpic.xhscdn.com/img1.jpg" },
							{ url: "//sns-webpic.xhscdn.com/img2.jpg" },
							{ infoList: [{ url: "https://sns-webpic.xhscdn.com/img3.jpg" }] }
						]
					}
				}
			}
		}
	};
	const html = `<html><body><script>window.__INITIAL_STATE__ = ${JSON.stringify(state)};</script></body></html>`;
	const images = extractImages(html);
	assert.deepEqual(images, [
		"http://sns-webpic.xhscdn.com/img1.jpg",
		"https://sns-webpic.xhscdn.com/img2.jpg",
		"https://sns-webpic.xhscdn.com/img3.jpg"
	]);
});

test("extractVideoUrl extracts stream masterUrl", () => {
	const state = {
		note: {
			noteDetailMap: {
				"6a7575": {
					note: {
						type: "video",
						video: {
							media: {
								stream: {
									h264: [{ masterUrl: "http://sns-video.xhscdn.com/video.mp4" }]
								}
							}
						}
					}
				}
			}
		}
	};
	const html = `<html><body><script>window.__INITIAL_STATE__ = ${JSON.stringify(state)};</script></body></html>`;
	assert.equal(extractVideoUrl(html), "http://sns-video.xhscdn.com/video.mp4");
	assert.equal(isVideoNote(html), true);
});

test("extractContent cleans topic brackets and falls back to description", () => {
	const state = {
		note: {
			noteDetailMap: {
				"6a7575": {
					note: {
						desc: "今天天气真好[话题]# 推荐大家去公园散步！ [公园[话题]#]"
					}
				}
			}
		}
	};
	const html = `<html><body><script>window.__INITIAL_STATE__ = ${JSON.stringify(state)};</script></body></html>`;
	const content = extractContent(html);
	assert.equal(content, "今天天气真好# 推荐大家去公园散步！");
});
