import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Video, Loader2, Star, Eye, EyeOff, GripVertical } from 'lucide-react';

interface VideoTutorial {
  id: string;
  title: string;
  youtube_id: string;
  description: string | null;
  order_index: number | null;
  is_visible: boolean;
  is_featured: boolean;
  created_at: string | null;
}

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<VideoTutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingVideo, setEditingVideo] = useState<VideoTutorial | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    youtube_id: '',
    description: '',
    order_index: 0,
    is_visible: true,
    is_featured: false,
  });

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      setVideos(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch videos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (video?: VideoTutorial) => {
    if (video) {
      setEditingVideo(video);
      setFormData({
        title: video.title,
        youtube_id: video.youtube_id,
        description: video.description || '',
        order_index: video.order_index || 0,
        is_visible: video.is_visible,
        is_featured: video.is_featured,
      });
    } else {
      setEditingVideo(null);
      setFormData({
        title: '',
        youtube_id: '',
        description: '',
        order_index: videos.length,
        is_visible: true,
        is_featured: false,
      });
    }
    setIsDialogOpen(true);
  };

  const extractYoutubeId = (url: string): string => {
    // Handle various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return url;
  };

  const handleSave = async () => {
    if (!formData.title || !formData.youtube_id) {
      toast.error('Title and YouTube ID/URL are required');
      return;
    }

    setSaving(true);
    try {
      const videoData = {
        title: formData.title,
        youtube_id: extractYoutubeId(formData.youtube_id),
        description: formData.description || null,
        order_index: formData.order_index,
        is_visible: formData.is_visible,
        is_featured: formData.is_featured,
      };

      if (editingVideo) {
        const { error } = await supabase
          .from('videos')
          .update(videoData)
          .eq('id', editingVideo.id);
        if (error) throw error;
        toast.success('Video updated successfully');
      } else {
        const { error } = await supabase
          .from('videos')
          .insert(videoData);
        if (error) throw error;
        toast.success('Video added successfully');
      }

      setIsDialogOpen(false);
      fetchVideos();
    } catch (error: any) {
      toast.error('Failed to save video: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;

    try {
      const { error } = await supabase.from('videos').delete().eq('id', id);
      if (error) throw error;
      toast.success('Video deleted successfully');
      fetchVideos();
    } catch (error: any) {
      toast.error('Failed to delete video: ' + error.message);
    }
  };

  const toggleVisibility = async (video: VideoTutorial) => {
    try {
      const { error } = await supabase
        .from('videos')
        .update({ is_visible: !video.is_visible })
        .eq('id', video.id);

      if (error) throw error;
      toast.success(video.is_visible ? 'Video hidden' : 'Video visible');
      fetchVideos();
    } catch (error: any) {
      toast.error('Failed to update video: ' + error.message);
    }
  };

  const toggleFeatured = async (video: VideoTutorial) => {
    try {
      const { error } = await supabase
        .from('videos')
        .update({ is_featured: !video.is_featured })
        .eq('id', video.id);

      if (error) throw error;
      toast.success(video.is_featured ? 'Removed from featured' : 'Marked as featured');
      fetchVideos();
    } catch (error: any) {
      toast.error('Failed to update video: ' + error.message);
    }
  };

  return (
    <AdminLayout title="Video Tutorials" description="Manage tutorial videos for users">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">Add YouTube video tutorials that users can watch</p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Video
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingVideo ? 'Edit Video' : 'Add New Video'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Getting Started with Recruitsy"
                  />
                </div>
                <div>
                  <Label>YouTube URL or Video ID</Label>
                  <Input
                    value={formData.youtube_id}
                    onChange={(e) => setFormData({ ...formData, youtube_id: e.target.value })}
                    placeholder="https://youtube.com/watch?v=... or video ID"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Paste full YouTube URL or just the video ID
                  </p>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Learn how to..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Order Index</Label>
                  <Input
                    type="number"
                    value={formData.order_index}
                    onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_visible}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_visible: checked })}
                    />
                    <Label>Visible to users</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_featured}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                    />
                    <Label>Featured</Label>
                  </div>
                </div>
                {formData.youtube_id && (
                  <div>
                    <Label>Preview</Label>
                    <div className="mt-2 aspect-video rounded-lg overflow-hidden bg-muted">
                      <img
                        src={`https://img.youtube.com/vi/${extractYoutubeId(formData.youtube_id)}/maxresdefault.jpg`}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${extractYoutubeId(formData.youtube_id)}/hqdefault.jpg`;
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingVideo ? 'Update' : 'Add'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : videos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No videos yet</h3>
              <p className="text-muted-foreground mb-4">Add your first tutorial video</p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Video
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {videos.map((video) => (
              <Card key={video.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      <img
                        src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                        alt={video.title}
                        className="w-32 h-20 object-cover rounded-lg"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{video.title}</h3>
                        {video.is_featured && (
                          <Badge variant="default" className="bg-yellow-500">
                            <Star className="h-3 w-3 mr-1" />
                            Featured
                          </Badge>
                        )}
                        {!video.is_visible && (
                          <Badge variant="secondary">Hidden</Badge>
                        )}
                      </div>
                      {video.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {video.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleFeatured(video)}
                        title={video.is_featured ? 'Remove from featured' : 'Mark as featured'}
                      >
                        <Star className={`h-4 w-4 ${video.is_featured ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleVisibility(video)}
                        title={video.is_visible ? 'Hide' : 'Show'}
                      >
                        {video.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(video)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(video.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
