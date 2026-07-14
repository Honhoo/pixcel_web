import { useEffect, useMemo, useState } from "react";
import { checkAdminSession, logoutAdmin } from "./auth";
import type { CaseStudy, Category, MasonryMediaItem, MediaItem } from "./cases";

const emptyCase: CaseStudy = {
  id: "",
  title: "",
  category: "KEY VISUAL",
  year: "2026",
  summary: "",
  tags: [],
  cover: "",
  featured: false,
  featuredOrder: 99,
  masonry: true,
  masonryOrder: 99,
  masonryImages: [],
  masonryMedia: [],
  detailMedia: [],
};

const categoryOptions: Category[] = ["KEY VISUAL", "PACKAGE", "媒体传播", "虚幻引擎"];

function createId(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function normalizeCase(item: CaseStudy): CaseStudy {
  return {
    ...item,
    id: createId(item.id || item.title),
    tags: item.tags.filter(Boolean),
    masonryImages: item.masonryImages.filter(Boolean),
    masonryMedia: [
      ...(item.masonryMedia || []),
      ...item.masonryImages.map((src): MasonryMediaItem => ({ type: "image", src, alt: item.title })),
    ].filter((media, index, allMedia) => media.src && allMedia.findIndex((item) => item.src === media.src && item.type === media.type) === index),
    detailMedia: item.detailMedia.filter((media) => media.src),
    featuredOrder: Number(item.featuredOrder) || 99,
    masonryOrder: Number(item.masonryOrder) || 99,
  };
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length) return items;
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function Admin() {
  const [cases, setCases] = useState<CaseStudy[]>([]);
  const [activeId, setActiveId] = useState("");
  const [draft, setDraft] = useState<CaseStudy>(emptyCase);
  const [tagDraft, setTagDraft] = useState("");
  const [status, setStatus] = useState("正在读取案例数据...");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    checkAdminSession().then((ok) => {
      if (!ok) window.location.href = "/login";
    });
  }, []);

  const sortedCases = useMemo(
    () => [...cases].sort((a, b) => a.featuredOrder - b.featuredOrder || a.masonryOrder - b.masonryOrder),
    [cases],
  );

  useEffect(() => {
    fetch("/api/admin/cases")
      .then((res) => {
        if (!res.ok) throw new Error("后台服务未启动");
        return res.json();
      })
      .then((data: CaseStudy[]) => {
        const normalizedData = data.map(normalizeCase);
        setCases(normalizedData);
        setActiveId(normalizedData[0]?.id || "");
        setDraft(normalizedData[0] || emptyCase);
        setStatus("案例数据已载入");
      })
      .catch((error) => setStatus(`读取失败：${error.message}`));
  }, []);

  const updateDraft = <Key extends keyof CaseStudy>(key: Key, value: CaseStudy[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const selectCase = (item: CaseStudy) => {
    setActiveId(item.id);
    setDraft(item);
    setTagDraft("");
  };

  const addCase = () => {
    const nextOrder = cases.length + 1;
    setActiveId("");
    setDraft({
      ...emptyCase,
      id: `case-${Date.now()}`,
      featuredOrder: nextOrder,
      masonryOrder: nextOrder,
    });
    setTagDraft("");
    setStatus("正在新增案例");
  };

  const addTag = () => {
    const nextTag = tagDraft.trim();
    if (!nextTag || draft.tags.includes(nextTag)) return;
    updateDraft("tags", [...draft.tags, nextTag]);
    setTagDraft("");
  };

  const removeTag = (tag: string) => {
    updateDraft(
      "tags",
      draft.tags.filter((item) => item !== tag),
    );
  };

  const saveCases = async (nextCases: CaseStudy[], message = "已保存") => {
    const response = await fetch("/api/admin/cases", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextCases),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "保存失败");
    }
    setCases(nextCases);
    setStatus(message);
  };

  const saveDraft = async () => {
    try {
      const normalized = normalizeCase(draft);
      if (!normalized.id || !normalized.title || !normalized.cover) {
        setStatus("请至少填写 ID、标题和封面图");
        return;
      }
      const duplicate = cases.find((item) => item.id === normalized.id && item.id !== activeId);
      if (duplicate) {
        setStatus("案例 ID 已存在，请换一个 ID");
        return;
      }
      const exists = cases.some((item) => item.id === activeId);
      const nextCases = exists
        ? cases.map((item) => (item.id === activeId ? normalized : item))
        : [...cases, normalized];
      await saveCases(nextCases, "案例已保存，刷新前台即可看到更新");
      setActiveId(normalized.id);
      setDraft(normalized);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败");
    }
  };

  const deleteCase = async () => {
    if (!activeId) return;
    const nextCases = cases.filter((item) => item.id !== activeId);
    await saveCases(nextCases, "案例已删除");
    setActiveId(nextCases[0]?.id || "");
    setDraft(nextCases[0] || emptyCase);
  };

  const uploadFiles = async (target: "cover" | "masonry" | "detail", files: FileList | null) => {
    if (!files?.length) return;
    const caseId = createId(draft.id || draft.title);
    if (!caseId) {
      setStatus("上传前请先填写案例 ID 或标题");
      return;
    }
    setUploading(true);
    setStatus("正在上传素材...");
    try {
      const formData = new FormData();
      formData.append("caseId", caseId);
      Array.from(files).forEach((file) => formData.append("files", file));
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "上传失败");
      }
      const data: { files: Array<{ path: string; type: "image" | "video" }> } = await response.json();
      const paths = data.files.map((file) => file.path);
      setDraft((current) => {
        if (target === "cover") return { ...current, id: caseId, cover: paths[0] || current.cover };
        if (target === "masonry") {
          const existingMedia =
            current.masonryMedia || current.masonryImages.map((src): MasonryMediaItem => ({ type: "image", src, alt: current.title || caseId }));
          return {
            ...current,
            id: caseId,
            masonryMedia: [
              ...existingMedia,
              ...data.files.map((file): MasonryMediaItem => ({
                type: file.type,
                src: file.path,
                poster: file.type === "video" ? current.cover : undefined,
                alt: current.title || caseId,
              })),
            ],
          };
        }
        return {
          ...current,
          id: caseId,
          detailMedia: [
            ...current.detailMedia,
            ...data.files.map((file): MediaItem => ({
              type: file.type,
              src: file.path,
              poster: file.type === "video" ? current.cover : undefined,
              alt: current.title || caseId,
            })),
          ],
        };
      });
      setStatus("素材已上传，记得点击保存案例");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const onLogout = () => {
    logoutAdmin();
    window.location.href = "/";
  };

  const removeAssetFile = async (assetPath: string) => {
    await fetch(`/api/admin/file?path=${encodeURIComponent(assetPath)}`, { method: "DELETE" });
  };

  const removeMasonryImage = async (src: string, deleteFile = false) => {
    if (deleteFile) await removeAssetFile(src);
    setDraft((current) => ({
      ...current,
      masonryImages: current.masonryImages.filter((item) => item !== src),
      masonryMedia: (current.masonryMedia || []).filter((item) => item.src !== src),
    }));
  };

  const removeDetailMedia = async (src: string, deleteFile = false) => {
    if (deleteFile) await removeAssetFile(src);
    updateDraft(
      "detailMedia",
      draft.detailMedia.filter((item) => item.src !== src),
    );
  };

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>CASE CMS</span>
          <h1>案例后台</h1>
        </div>
        <button className="admin-primary" onClick={addCase}>
          新增案例
        </button>
        <div className="admin-case-list">
          {sortedCases.map((item) => (
            <button
              className={activeId === item.id ? "active" : ""}
              key={item.id}
              onClick={() => selectCase(item)}
            >
              <strong>{item.title}</strong>
              <span>
                {item.category} / 精品 {item.featured ? "开" : "关"} / 瀑布流 {item.masonry ? "开" : "关"}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="admin-editor">
        <header className="admin-toolbar">
          <div>
            <span>{status}</span>
            <h2>{draft.title || "未命名案例"}</h2>
          </div>
          <div className="admin-actions">
            <a href="/#cases">查看前台</a>
            <button onClick={onLogout}>退出登录</button>
            <button onClick={deleteCase} disabled={!activeId}>
              删除案例
            </button>
            <button className="admin-primary" onClick={saveDraft}>
              保存案例
            </button>
          </div>
        </header>

        <div className="admin-grid">
          <label>
            案例 ID
            <input value={draft.id} onChange={(event) => updateDraft("id", createId(event.target.value))} />
          </label>
          <label>
            标题
            <input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
          </label>
          <label>
            分类
            <select value={draft.category} onChange={(event) => updateDraft("category", event.target.value as Category)}>
              {categoryOptions.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            年份
            <input value={draft.year} onChange={(event) => updateDraft("year", event.target.value)} />
          </label>
          <div className="admin-tag-editor">
            <span>标签</span>
            <div className="admin-tag-input-row">
              <input
                value={tagDraft}
                placeholder="输入标签后按 Enter 或点击添加"
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                  }
                }}
              />
              <button type="button" onClick={addTag}>
                添加标签
              </button>
            </div>
            <div className="admin-tag-list">
              {draft.tags.length > 0 ? (
                draft.tags.map((tag) => (
                  <button type="button" key={tag} onClick={() => removeTag(tag)}>
                    {tag}
                    <span>×</span>
                  </button>
                ))
              ) : (
                <em>暂无标签</em>
              )}
            </div>
          </div>
          <label className="admin-field-wide">
            简介
            <textarea value={draft.summary} onChange={(event) => updateDraft("summary", event.target.value)} />
          </label>
        </div>

        <div className="admin-switches">
          <label>
            <input type="checkbox" checked={draft.featured} onChange={(event) => updateDraft("featured", event.target.checked)} />
            精品案例
          </label>
          <label>
            精品排序
            <input
              type="number"
              value={draft.featuredOrder}
              onChange={(event) => updateDraft("featuredOrder", Number(event.target.value))}
            />
          </label>
          <label>
            <input type="checkbox" checked={draft.masonry} onChange={(event) => updateDraft("masonry", event.target.checked)} />
            瀑布流展示
          </label>
          <label>
            瀑布流排序
            <input
              type="number"
              value={draft.masonryOrder}
              onChange={(event) => updateDraft("masonryOrder", Number(event.target.value))}
            />
          </label>
        </div>

        <section className="admin-upload-panel">
          <div>
            <h3>封面图</h3>
            <p>{draft.cover || "还没有封面图"}</p>
            {draft.cover && <img className="admin-cover-preview" src={draft.cover} alt="" />}
            <input type="file" accept="image/*" onChange={(event) => uploadFiles("cover", event.target.files)} disabled={uploading} />
          </div>

          <div>
            <h3>图片墙展示素材</h3>
            <p>可上传图片或视频。没有额外素材时，前台会自动使用封面图展示。</p>
            <input type="file" accept="image/*,video/*" multiple onChange={(event) => uploadFiles("masonry", event.target.files)} disabled={uploading} />
            <MasonryMediaList
              items={draft.masonryMedia || draft.masonryImages.map((src) => ({ type: "image", src, alt: draft.title }))}
              onChange={(items) => updateDraft("masonryMedia", items)}
              onRemove={removeMasonryImage}
            />
          </div>

          <div>
            <h3>详情媒体</h3>
            <input type="file" accept="image/*,video/*" multiple onChange={(event) => uploadFiles("detail", event.target.files)} disabled={uploading} />
            <MediaList items={draft.detailMedia} onChange={(items) => updateDraft("detailMedia", items)} onRemove={removeDetailMedia} />
          </div>
        </section>
      </section>
    </main>
  );
}

function MasonryMediaList({
  items,
  onChange,
  onRemove,
}: {
  items: MasonryMediaItem[];
  onChange: (items: MasonryMediaItem[]) => void;
  onRemove: (src: string, deleteFile?: boolean) => void;
}) {
  if (items.length === 0) return <p className="admin-empty">暂无额外素材，将自动使用封面图</p>;
  return (
    <div className="admin-assets">
      {items.map((media, index) => (
        <div className="admin-asset detail" key={`${media.src}-${index}`}>
          <div className="admin-asset-order">
            <strong>{String(index + 1).padStart(2, "0")}</strong>
            <button type="button" onClick={() => onChange(moveItem(items, index, index - 1))} disabled={index === 0}>
              上移
            </button>
            <button type="button" onClick={() => onChange(moveItem(items, index, index + 1))} disabled={index === items.length - 1}>
              下移
            </button>
          </div>
          {media.type === "image" ? <img src={media.src} alt="" /> : <video src={media.src} muted />}
          <input
            value={media.alt || ""}
            placeholder="素材说明，可留空"
            onChange={(event) =>
              onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, alt: event.target.value } : item)))
            }
          />
          {media.type === "video" && (
            <input
              placeholder="视频封面 poster，可留空"
              value={media.poster || ""}
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, poster: event.target.value } : item)))
              }
            />
          )}
          <span>{media.src}</span>
          <div className="admin-asset-actions">
            <button type="button" onClick={() => onRemove(media.src)}>
              移除
            </button>
            <button type="button" onClick={() => onRemove(media.src, true)}>
              删除文件
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MediaList({
  items,
  onChange,
  onRemove,
}: {
  items: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  onRemove: (src: string, deleteFile?: boolean) => void;
}) {
  if (items.length === 0) return <p className="admin-empty">暂无详情媒体</p>;
  return (
    <div className="admin-assets">
      {items.map((media, index) => (
        <div className="admin-asset detail" key={`${media.src}-${index}`}>
          <div className="admin-asset-order">
            <strong>{String(index + 1).padStart(2, "0")}</strong>
            <button type="button" onClick={() => onChange(moveItem(items, index, index - 1))} disabled={index === 0}>
              上移
            </button>
            <button type="button" onClick={() => onChange(moveItem(items, index, index + 1))} disabled={index === items.length - 1}>
              下移
            </button>
          </div>
          {media.type === "image" ? <img src={media.src} alt="" /> : <video src={media.src} muted />}
          <input
            value={media.alt}
            onChange={(event) =>
              onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, alt: event.target.value } : item)))
            }
          />
          {media.type === "video" && (
            <input
              placeholder="视频封面 poster，可留空"
              value={media.poster || ""}
              onChange={(event) =>
                onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, poster: event.target.value } : item)))
              }
            />
          )}
          <span>{media.src}</span>
          <div className="admin-asset-actions">
            <button type="button" onClick={() => onRemove(media.src)}>
              移除
            </button>
            <button type="button" onClick={() => onRemove(media.src, true)}>
              删除文件
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Admin;
