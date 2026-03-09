export type RequestStatus = 'under-consideration' | 'planned' | 'in-development' | 'shipped';

export type RequestTopic = 
  | 'new-feature' 
  | 'improvement' 
  | 'integrations' 
  | 'deal-breaker' 
  | 'bug' 
  | 'crm' 
  | 'store' 
  | 'account' 
  | 'marketing';

export interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  status: RequestStatus;
  topic: RequestTopic;
  upvotes: number;
  author: string;
  createdAt: any; // Firestore Timestamp
  commentCount: number;
  labels: string[];
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  image?: string;
  date: any; // Firestore Timestamp
  type: 'announcement' | 'update' | 'shipped';
  requestId?: string;
}
