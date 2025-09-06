export interface User {
  id: string
  handle: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  created_at: string
}

export interface Post {
  id: string
  author_id: string
  text: string
  reply_to_post_id: string | null
  created_at: string
}
