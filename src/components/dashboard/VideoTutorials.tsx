import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Video, Play, Star, ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface VideoTutorial {
  id: string;
  title: string;
  youtube_id: string;
  description: string | null;
  is_featured: boolean;
}

export function VideoTutorials() {
  const [videos, setVideos] = useState<VideoTutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoTutorial | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, youtube_id, description, is_featured')
        .eq('is_visible', true)
        .order('order_index', { ascending: true })
        .limit(5);

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Video Tutorials
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (videos.length === 0) {
    return null;
  }

  const displayedVideos = showAll ? videos : videos.slice(0, 3);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            Video Tutorials
          </CardTitle>
          {videos.length > 3 && (
            <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show Less' : 'View All'}
              <ChevronRight className={`h-4 w-4 ml-1 transition-transform ${showAll ? 'rotate-90' : ''}`} />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {displayedVideos.map((video) => (
              <div
                key={video.id}
                className="group cursor-pointer"
                onClick={() => setSelectedVideo(video)}
              >
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="h-5 w-5 text-primary fill-primary ml-0.5" />
                    </div>
                  </div>
                  {video.is_featured && (
                    <Badge className="absolute top-2 left-2 bg-yellow-500 text-yellow-950">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      Featured
                    </Badge>
                  )}
                </div>
                <h4 className="font-medium mt-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {video.title}
                </h4>
                {video.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                    {video.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Video Player Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{selectedVideo?.title}</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-4">
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              {selectedVideo && (
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${selectedVideo.youtube_id}?autoplay=1`}
                  title={selectedVideo.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
            {selectedVideo?.description && (
              <p className="text-muted-foreground mt-4">{selectedVideo.description}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
