import { FastifyInstance } from 'fastify'

/**
 * 酷狗音乐 API 代理
 * 直接调用酷狗移动端公开接口，无需额外服务器
 */
async function kugou(fastify: FastifyInstance) {
  const KUGOU_MOBILE = 'http://mobilecdn.kugou.com/api/v3'

  // 将酷狗移动端数据转换为插件期望的格式
  const formatSong = (item: any) => ({
    ...item,
    songid: item.audio_id || item.songid,
    songname: item.songname || item.audio_name,
    album_id: item.album_id,
    album_name: item.album_name,
    singername: item.singername,
    timelen: (item.duration || 0) * 1000,
    sizable_cover:
      item.trans_param?.union_cover ||
      `http://imge.kugou.com/stdmusic/{size}/${item.album_id}.jpg`,
  })

  // 搜索
  fastify.get('/kugou/search', async (req, reply) => {
    try {
      const { keywords, page = 1, type = 'song' } = req.query as Record<string, string>
      const pageNum = Number(page) || 1

      const endpoint =
        type === 'song'
          ? `${KUGOU_MOBILE}/search/song`
          : type === 'album'
            ? `${KUGOU_MOBILE}/search/album`
            : type === 'author'
              ? `${KUGOU_MOBILE}/search/author`
              : type === 'special'
                ? `${KUGOU_MOBILE}/search/special`
                : `${KUGOU_MOBILE}/search/song`

      const url = `${endpoint}?format=json&keyword=${encodeURIComponent(keywords)}&page=${pageNum}&pagesize=30`
      const res = await fetch(url, { headers: { 'User-Agent': 'Android16' } })
      const data = await res.json()

      if (type === 'song') {
        const info = (data.data?.info || []).map(formatSong)
        return reply.send({
          status: 1,
          data: { lists: info, total: data.data?.total || info.length },
        })
      }
      if (type === 'album') {
        const list = data.data?.list || data.data?.info || []
        return reply.send({
          status: 1,
          data: { lists: list, total: data.data?.total || list.length },
        })
      }
      if (type === 'author') {
        const list = data.data?.list || data.data?.info || []
        return reply.send({
          status: 1,
          data: { lists: list, total: data.data?.total || list.length },
        })
      }
      if (type === 'special') {
        const list = data.data?.list || data.data?.info || []
        return reply.send({
          status: 1,
          data: { lists: list, total: data.data?.total || list.length },
        })
      }
      return reply.send({ status: 1, data: { lists: [], total: 0 } })
    } catch (e) {
      return reply.status(500).send({ status: 0, error: String(e) })
    }
  })

  fastify.get('/kugou/register/dev', async (_req, reply) => {
    return reply.send({ status: 1, data: { dfid: '' } })
  })

  fastify.get('/kugou/top/playlist', async (_req, reply) => {
    try {
      const res = await fetch(`${KUGOU_MOBILE}/special/recommend?format=json&page=1&pagesize=30`, {
        headers: { 'User-Agent': 'Android16' },
      })
      const data = await res.json()
      const info = data.data?.info || data.data?.list || []
      return reply.send({ status: 1, data: { special_list: info } })
    } catch {
      return reply.send({ status: 1, data: { special_list: [] } })
    }
  })

  fastify.get('/kugou/everyday/recommend', async (_req, reply) => {
    return reply.send({ status: 1, data: { song_list: [] } })
  })

  fastify.get('/kugou/personal/fm', async (_req, reply) => {
    return reply.send({ status: 1, data: { song_list: [] } })
  })

  fastify.get('/kugou/user/vip/detail', async (_req, reply) => {
    return reply.send({ status: 1, data: {} })
  })

  // 获取播放地址
  fastify.get('/kugou/song/url', async (req, reply) => {
    try {
      const { hash } = req.query as Record<string, string>
      if (!hash) return reply.send({ status: 0, url: [], backupUrl: [] })

      const res = await fetch(
        `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`,
        { headers: { 'User-Agent': 'Android16' } }
      )
      const data = await res.json()

      const playUrl = data.url || ''
      const backupUrls = []
      if (data.backup_url && typeof data.backup_url === 'object') {
        for (const key of Object.keys(data.backup_url)) {
          if (data.backup_url[key]) backupUrls.push(data.backup_url[key])
        }
      }

      return reply.send({
        status: playUrl ? 1 : 0,
        url: playUrl ? [playUrl] : [],
        backupUrl: backupUrls,
        volume: data.volume || 0,
        volume_peak: data.volume_peak || 1,
      })
    } catch (e) {
      return reply.send({ status: 0, url: [], backupUrl: [] })
    }
  })

  // 搜索歌词
  fastify.get('/kugou/search/lyric', async (req, reply) => {
    try {
      const { hash, duration = '' } = req.query as Record<string, string>
      if (!hash) return reply.send({ candidates: [] })

      const url =
        `http://lyrics.kugou.com/search?ver=1&man=yes&client=pc&hash=${hash}` +
        (duration ? `&duration=${duration}` : '')
      const res = await fetch(url)
      const data = await res.json()
      const candidates = (data.candidates || []).map((item: any) => ({
        id: item.id,
        accesskey: item.accesskey,
      }))
      return reply.send({ candidates })
    } catch {
      return reply.send({ candidates: [] })
    }
  })

  // 获取歌词内容
  fastify.get('/kugou/lyric', async (req, reply) => {
    try {
      const { id, accesskey } = req.query as Record<string, string>
      if (!id || !accesskey) return reply.send({ decodeContent: '' })

      const res = await fetch(
        `http://lyrics.kugou.com/download?ver=1&client=pc&id=${id}&accesskey=${accesskey}&fmt=lrc&charset=utf8`
      )
      const data = await res.json()

      let decodeContent = ''
      if (data.content) {
        decodeContent = Buffer.from(data.content, 'base64').toString('utf-8')
      }
      return reply.send({ decodeContent })
    } catch {
      return reply.send({ decodeContent: '' })
    }
  })
}

export default kugou
