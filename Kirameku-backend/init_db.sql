-- Kirameku Blog - PostgreSQL 建表脚本
-- 执行方式: psql -U postgres -d kirameku -f init_db.sql

-- ============================================
-- 1. User（用户/管理员）
-- ============================================
CREATE TABLE IF NOT EXISTS "user" (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    hashed_password VARCHAR(128) NOT NULL,
    nickname      VARCHAR(50)  DEFAULT '',
    avatar        VARCHAR(500) DEFAULT '',
    email         VARCHAR(100) DEFAULT '',
    bio           VARCHAR(500) DEFAULT '',
    is_admin      BOOLEAN      DEFAULT FALSE,
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

-- ============================================
-- 2. Category（分类）
-- ============================================
CREATE TABLE IF NOT EXISTS category (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(50)  UNIQUE NOT NULL,
    slug          VARCHAR(50)  UNIQUE NOT NULL,
    description   VARCHAR(200) DEFAULT '',
    sort          INTEGER      DEFAULT 0,
    post_count    INTEGER      DEFAULT 0,
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

-- ============================================
-- 3. Tag（标签）
-- ============================================
CREATE TABLE IF NOT EXISTS tag (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(50)  UNIQUE NOT NULL,
    slug          VARCHAR(50)  UNIQUE NOT NULL,
    post_count    INTEGER      DEFAULT 0
);

-- ============================================
-- 4. Post（文章）
-- ============================================
CREATE TABLE IF NOT EXISTS post (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(200) NOT NULL,
    slug          VARCHAR(200) UNIQUE NOT NULL,
    description   VARCHAR(500) DEFAULT '',
    content       TEXT         DEFAULT '',
    cover         VARCHAR(500) DEFAULT '',
    category_id   INTEGER      REFERENCES category(id) ON DELETE SET NULL,
    status        VARCHAR(20)  DEFAULT 'draft',
    is_pinned     BOOLEAN      DEFAULT FALSE,
    views         INTEGER      DEFAULT 0,
    likes         INTEGER      DEFAULT 0,
    word_count    INTEGER      DEFAULT 0,
    reading_time  INTEGER      DEFAULT 0,
    published_at  TIMESTAMP,
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_slug ON post(slug);
CREATE INDEX IF NOT EXISTS idx_post_status ON post(status);
CREATE INDEX IF NOT EXISTS idx_post_category ON post(category_id);

-- ============================================
-- 5. PostTag（文章-标签 中间表）
-- ============================================
CREATE TABLE IF NOT EXISTS post_tag (
    post_id       INTEGER NOT NULL REFERENCES post(id) ON DELETE CASCADE,
    tag_id        INTEGER NOT NULL REFERENCES tag(id)  ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- ============================================
-- 6. GitHubUser（GitHub 登录用户）
-- ============================================
CREATE TABLE IF NOT EXISTS github_user (
    id            SERIAL PRIMARY KEY,
    github_id     INTEGER      UNIQUE NOT NULL,
    login         VARCHAR(100) NOT NULL,
    avatar        VARCHAR(500) DEFAULT '',
    bio           VARCHAR(500) DEFAULT '',
    created_at    TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_github_user_id ON github_user(github_id);

-- ============================================
-- 7. Comment（文章评论 — GitHub 登录）
-- ============================================
CREATE TABLE IF NOT EXISTS comment (
    id              SERIAL PRIMARY KEY,
    post_id         INTEGER      NOT NULL REFERENCES post(id) ON DELETE CASCADE,
    parent_id       INTEGER      REFERENCES comment(id) ON DELETE CASCADE,
    github_user_id  INTEGER      REFERENCES github_user(id) ON DELETE SET NULL,
    content         TEXT         NOT NULL,
    likes           INTEGER      DEFAULT 0,
    ip              VARCHAR(45)  DEFAULT '',
    status          VARCHAR(20)  DEFAULT 'approved',
    created_at      TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_post ON comment(post_id);
CREATE INDEX IF NOT EXISTS idx_comment_status ON comment(status);
CREATE INDEX IF NOT EXISTS idx_comment_github_user ON comment(github_user_id);

-- ============================================
-- 8. Message（留言板/杂谈）
-- ============================================
CREATE TABLE IF NOT EXISTS message (
    id              SERIAL PRIMARY KEY,
    github_user_id  INTEGER      REFERENCES github_user(id) ON DELETE SET NULL,
    parent_id       INTEGER      REFERENCES message(id) ON DELETE CASCADE,
    content         TEXT         NOT NULL,
    ip              VARCHAR(45)  DEFAULT '',
    status          VARCHAR(20)  DEFAULT 'approved',
    likes           INTEGER      DEFAULT 0,
    created_at      TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_status ON message(status);
CREATE INDEX IF NOT EXISTS idx_message_parent ON message(parent_id);
CREATE INDEX IF NOT EXISTS idx_message_github_user ON message(github_user_id);

-- ============================================
-- 9. Chatter（说说/微语）
-- ============================================
CREATE TABLE IF NOT EXISTS chatter (
    id              SERIAL PRIMARY KEY,
    content         TEXT         NOT NULL,
    images          TEXT         DEFAULT '[]',
    mood            VARCHAR(20)  DEFAULT '',
    likes           INTEGER      DEFAULT 0,
    comments_count  INTEGER      DEFAULT 0,
    status          VARCHAR(20)  DEFAULT 'draft',
    created_at      TIMESTAMP    DEFAULT NOW(),
    updated_at      TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatter_status ON chatter(status);

-- ============================================
-- 10. ChatterComment（说说评论 — GitHub 登录）
-- ============================================
CREATE TABLE IF NOT EXISTS chatter_comment (
    id              SERIAL PRIMARY KEY,
    chatter_id      INTEGER      NOT NULL REFERENCES chatter(id) ON DELETE CASCADE,
    parent_id       INTEGER      REFERENCES chatter_comment(id) ON DELETE CASCADE,
    github_user_id  INTEGER      REFERENCES github_user(id) ON DELETE SET NULL,
    content         TEXT         NOT NULL,
    ip              VARCHAR(45)  DEFAULT '',
    likes           INTEGER      DEFAULT 0,
    status          VARCHAR(20)  DEFAULT 'approved',
    created_at      TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatter_comment_chatter ON chatter_comment(chatter_id);
CREATE INDEX IF NOT EXISTS idx_chatter_comment_status ON chatter_comment(status);
CREATE INDEX IF NOT EXISTS idx_chatter_comment_github_user ON chatter_comment(github_user_id);

-- ============================================
-- 11. Album（相册）
-- ============================================
CREATE TABLE IF NOT EXISTS album (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(100) NOT NULL,
    description   VARCHAR(500) DEFAULT '',
    cover         VARCHAR(500) DEFAULT '',
    photo_count   INTEGER      DEFAULT 0,
    sort          INTEGER      DEFAULT 0,
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

-- ============================================
-- 12. Photo（照片）
-- ============================================
CREATE TABLE IF NOT EXISTS photo (
    id            SERIAL PRIMARY KEY,
    album_id      INTEGER      NOT NULL REFERENCES album(id) ON DELETE CASCADE,
    url           VARCHAR(500) NOT NULL,
    caption       VARCHAR(200) DEFAULT '',
    orientation   VARCHAR(20)  DEFAULT 'landscape',
    sort          INTEGER      DEFAULT 0,
    created_at    TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photo_album ON photo(album_id);

-- ============================================
-- 13. Project（项目展示）
-- ============================================
CREATE TABLE IF NOT EXISTS project (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(100) NOT NULL,
    slug             VARCHAR(100) UNIQUE NOT NULL,
    description      VARCHAR(500) DEFAULT '',
    long_description TEXT         DEFAULT '',
    cover_image      VARCHAR(500) DEFAULT '',
    tech_stack       TEXT         DEFAULT '[]',
    link_github      VARCHAR(300) DEFAULT '',
    link_gitee       VARCHAR(300) DEFAULT '',
    link_live        VARCHAR(300) DEFAULT '',
    link_docs        VARCHAR(300) DEFAULT '',
    status           VARCHAR(20)  DEFAULT 'developing',
    status_label     VARCHAR(20)  DEFAULT '',
    is_featured      BOOLEAN      DEFAULT FALSE,
    sort             INTEGER      DEFAULT 0,
    created_at       TIMESTAMP    DEFAULT NOW(),
    updated_at       TIMESTAMP    DEFAULT NOW()
);

-- ============================================
-- 14. FriendLink（友情链接）
-- ============================================
CREATE TABLE IF NOT EXISTS friend_link (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    url           VARCHAR(300) NOT NULL,
    avatar        VARCHAR(500) DEFAULT '',
    description   VARCHAR(300) DEFAULT '',
    sort          INTEGER      DEFAULT 0,
    is_approved   BOOLEAN      DEFAULT FALSE,
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

-- ============================================
-- 15. BookmarkCategory（收藏夹分类）
-- ============================================
CREATE TABLE IF NOT EXISTS bookmark_category (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(50)  NOT NULL,
    icon          VARCHAR(50)  DEFAULT '',
    description   VARCHAR(200) DEFAULT '',
    sort          INTEGER      DEFAULT 0,
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

-- ============================================
-- 16. BookmarkSite（收藏站点）
-- ============================================
CREATE TABLE IF NOT EXISTS bookmark_site (
    id            SERIAL PRIMARY KEY,
    category_id   INTEGER      NOT NULL REFERENCES bookmark_category(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    url           VARCHAR(300) NOT NULL,
    icon          VARCHAR(500) DEFAULT '',
    description   VARCHAR(300) DEFAULT '',
    platforms     TEXT         DEFAULT '[]',
    sort          INTEGER      DEFAULT 0,
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookmark_site_category ON bookmark_site(category_id);

-- ============================================
-- 17. SiteConfig（站点配置）
-- ============================================
CREATE TABLE IF NOT EXISTS site_config (
    id            SERIAL PRIMARY KEY,
    key           VARCHAR(100) UNIQUE NOT NULL,
    value         TEXT         DEFAULT '',
    description   VARCHAR(200) DEFAULT '',
    updated_at    TIMESTAMP    DEFAULT NOW()
);

-- ============================================
-- 18. Visitor（访客记录）
-- ============================================
CREATE TABLE IF NOT EXISTS visitor (
    id            SERIAL PRIMARY KEY,
    ip            VARCHAR(45)  NOT NULL,
    path          VARCHAR(500) DEFAULT '',
    user_agent    TEXT         DEFAULT '',
    city          VARCHAR(100) DEFAULT '',
    region        VARCHAR(100) DEFAULT '',
    country       VARCHAR(100) DEFAULT '',
    district      VARCHAR(100) DEFAULT '',
    org           VARCHAR(200) DEFAULT '',
    asn           VARCHAR(50)  DEFAULT '',
    is_mobile     BOOLEAN      DEFAULT FALSE,
    is_proxy      BOOLEAN      DEFAULT FALSE,
    is_hosting    BOOLEAN      DEFAULT FALSE,
    browser       VARCHAR(50)  DEFAULT '',
    os            VARCHAR(50)  DEFAULT '',
    device_type   VARCHAR(20)  DEFAULT '',
    created_at    TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitor_ip ON visitor(ip);
CREATE INDEX IF NOT EXISTS idx_visitor_created ON visitor(created_at DESC);

-- ============================================
-- Demo case（交互案例 Demo，静态包在服务器 DEMO_LOCAL_ROOT，经 demos.* 子域对外）
-- ============================================
CREATE TABLE IF NOT EXISTS demo_case (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    slug          VARCHAR(80)  UNIQUE NOT NULL,
    entry_path    VARCHAR(200) DEFAULT 'index.html',
    entry_query   VARCHAR(200) DEFAULT '',
    base_url      VARCHAR(300) DEFAULT '',
    status        INTEGER      DEFAULT 1,
    package_size  INTEGER      DEFAULT 0,
    file_count    INTEGER      DEFAULT 0,
    remark        VARCHAR(500) DEFAULT '',
    created_by    VARCHAR(50)  DEFAULT '',
    updated_by    VARCHAR(50)  DEFAULT '',
    created_at    TIMESTAMP    DEFAULT NOW(),
    updated_at    TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_case_slug ON demo_case(slug);

-- ============================================
-- 插入默认管理员账号（密码: admin123）
-- bcrypt hash of "admin123"
-- ============================================
INSERT INTO "user" (username, hashed_password, nickname, is_admin)
VALUES (
    'admin',
    '$2b$12$LJ3m4ys4Pz0C5eK8rZqYaOzLiGh5v1DmdMFRnDvMQfLpUfKlPu5S.',
    '管理员',
    TRUE
) ON CONFLICT (username) DO NOTHING;

-- ============================================
-- 插入默认站点配置
-- ============================================
INSERT INTO site_config (key, value, description) VALUES
    ('site_title',      '"Kirameku"',           '站点标题'),
    ('site_description', '"煌めく — 一个个人博客"', '站点描述'),
    ('icp_number',      '""',                    'ICP备案号'),
    ('icp_link',        '""',                    'ICP备案链接')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 19. ExternalApi（站外 API 配置）
-- ============================================
CREATE TABLE IF NOT EXISTS external_api (
    id            SERIAL PRIMARY KEY,
    key           VARCHAR(100) UNIQUE NOT NULL,
    name          VARCHAR(100) DEFAULT '',
    base_url      VARCHAR(500) DEFAULT '',
    path          VARCHAR(200) DEFAULT '',
    method        VARCHAR(10)  DEFAULT 'GET',
    enabled       BOOLEAN      DEFAULT TRUE,
    params        TEXT         DEFAULT '{}',
    description   VARCHAR(200) DEFAULT '',
    sort          INTEGER      DEFAULT 0,
    updated_at    TIMESTAMP    DEFAULT NOW()
);

INSERT INTO external_api (key, name, base_url, path, method, enabled, params, description, sort) VALUES
    ('hitokoto',            '一言',       'https://v1.hitokoto.cn', '', 'GET', TRUE, '{}', '句子/语录', 1),
    ('uapis_weather',       '天气',       'https://uapis.cn/api/v1/misc/weather', '', 'GET', TRUE, '{}', '天气查询', 2),
    ('uapis_random_image',  '随机图片',   'https://uapis.cn/api/v1/random/image', '', 'GET', TRUE, '{}', '随机图片', 3),
    ('xxapi_bilibilihot',   'B站热榜',    'https://v2.xxapi.cn/api/bilibilihot', '', 'GET', TRUE, '{}', 'B站热榜', 4),
    ('xxapi_dog',           '狗狗日记',   'https://v2.xxapi.cn/api/dog', '', 'GET', TRUE, '{}', '狗狗日记', 5),
    ('xxapi_dujitang',      '毒鸡汤',     'https://v2.xxapi.cn/api/dujitang', '', 'GET', TRUE, '{}', '毒鸡汤', 6),
    ('xxapi_history',       '历史今天',   'https://v2.xxapi.cn/api/history', '', 'GET', TRUE, '{}', '历史今天', 7),
    ('xxapi_bmi',           'BMI',        'https://v2.xxapi.cn/api/bmi', '', 'GET', TRUE, '{}', 'BMI 计算', 8),
    ('xxapi_goldprice',     '今日金价',   'https://v2.xxapi.cn/api/goldprice', '', 'GET', TRUE, '{}', '金价', 9),
    ('xxapi_jiakao',        '驾考题库',   'https://v2.xxapi.cn/api/jiakao', '', 'GET', TRUE, '{}', '驾考', 10),
    ('xxapi_horoscope',     '星座运势',   'https://v2.xxapi.cn/api/horoscope', '', 'GET', TRUE, '{}', '星座', 11),
    ('xxapi_genshin',       '原神图片',   'https://v2.xxapi.cn/api/ys', '', 'GET', TRUE, '{"return":"json"}', '原神', 12),
    ('xxapi_random4k',      '4K图片',     'https://v2.xxapi.cn/api/random4kPic', '', 'GET', TRUE, '{}', '4K 壁纸', 13),
    ('xxapi_guanyin',       '观音灵签',   'https://v2.xxapi.cn/api/guanyinrandom', '', 'GET', TRUE, '{}', '观音灵签', 14)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 20. SiteSetting（站点设置，结构化分组）
-- ============================================
CREATE TABLE IF NOT EXISTS site_setting (
    id            SERIAL PRIMARY KEY,
    key           VARCHAR(100) UNIQUE NOT NULL,
    value         TEXT         DEFAULT '',
    label         VARCHAR(100) DEFAULT '',
    "group"       VARCHAR(50)  DEFAULT 'basic',
    input_type    VARCHAR(20)  DEFAULT 'text',
    description   VARCHAR(200) DEFAULT '',
    sort          INTEGER      DEFAULT 0,
    updated_at    TIMESTAMP    DEFAULT NOW()
);

INSERT INTO site_setting (key, value, label, "group", input_type, description, sort) VALUES
    ('site_title',             '"白居易"',            '站点标题',   'basic',  'text', '导航栏与页面标题', 1),
    ('author_name',            '"小雨"',              '作者名',     'basic',  'text', '关于页作者名', 2),
    ('bio',                    '"个人前端与博客向小站，记录学习、折腾与日常。"', '站点简介', 'basic', 'text', 'SEO 描述与副标题', 3),
    ('avatar_url',             '"https://img.xiaoyu-hh.cn/photowall/hong.jpg"', '头像', 'basic', 'text', '头像图片地址', 4),
    ('github',                 '"https://github.com/xiaoyu-xxxx"', 'GitHub', 'social', 'text', 'GitHub 主页', 5),
    ('cloud_music_playlist_id', '"17943739323"',      '音乐歌单ID', 'music',  'text', '网易云歌单 ID', 6),
    ('chatter_title',          '"留言"',              '留言标题',   'content', 'text', '留言板块标题', 7),
    ('chatter_description',    '"生活、技术、随想的碎片记录"', '留言描述', 'content', 'text', '留言板块描述', 8)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 21. AboutPage（关于页）
-- ============================================
CREATE TABLE IF NOT EXISTS about_page (
    id            SERIAL PRIMARY KEY,
    content       TEXT         DEFAULT '',
    cover         VARCHAR(500) DEFAULT '',
    updated_at    TIMESTAMP    DEFAULT NOW()
);

INSERT INTO about_page (id, content, cover)
VALUES (
    1,
    '## 你好，我是小雨

前端与博客向的个人站点，喜欢折腾技术，偶尔写写文章记录学习与日常。',
    'https://img.xiaoyu-hh.cn/photowall/2.webp'
)
ON CONFLICT (id) DO NOTHING;
