
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ai_actions": {
                  Row: {
                    "created_at": string,"id": string,"preview": NonNullable<Json>,"status": Database["public"]['Enums']["ai_action_status"],"type": string,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"preview": NonNullable<Json>,"status"?: Database["public"]['Enums']["ai_action_status"],"type": string,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"preview"?: NonNullable<Json>,"status"?: Database["public"]['Enums']["ai_action_status"],"type"?: string,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_usage": {
                  Row: {
                    "created_at": string,"date": string,"id": string,"message_count": number,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"id"?: string,"message_count"?: number,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"id"?: string,"message_count"?: number,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"alert_type_ttl": {
                  Row: {
                    "ttl_hours": number,"type": Database["public"]['Enums']["alert_type"],"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ttl_hours": number,"type": Database["public"]['Enums']["alert_type"],"updated_at"?: string | null
                  }
                  Update: {
                    "ttl_hours"?: number,"type"?: Database["public"]['Enums']["alert_type"],"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"alerts": {
                  Row: {
                    "confirmed_at": string | null,"created_at": string,"expires_at": string,"geometry": unknown,"id": string,"reason_en": string | null,"reason_hi": string | null,"reason_mr": string | null,"reported_at": string,"severity": string,"source": string,"type": Database["public"]['Enums']["alert_type"],"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmed_at"?: string | null,"created_at"?: string,"expires_at": string,"geometry": unknown,"id"?: string,"reason_en"?: string | null,"reason_hi"?: string | null,"reason_mr"?: string | null,"reported_at"?: string,"severity": string,"source": string,"type": Database["public"]['Enums']["alert_type"],"updated_at"?: string | null
                  }
                  Update: {
                    "confirmed_at"?: string | null,"created_at"?: string,"expires_at"?: string,"geometry"?: unknown,"id"?: string,"reason_en"?: string | null,"reason_hi"?: string | null,"reason_mr"?: string | null,"reported_at"?: string,"severity"?: string,"source"?: string,"type"?: Database["public"]['Enums']["alert_type"],"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"app_config": {
                  Row: {
                    "key": string,"notes": string | null,"updated_at": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"notes"?: string | null,"updated_at"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"notes"?: string | null,"updated_at"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"audio_guides": {
                  Row: {
                    "created_at": string,"duration_s": number | null,"id": string,"lang": Database["public"]['Enums']["lang"],"place_id": string,"source": Database["public"]['Enums']["audio_source"],"storage_path": string,"transcript": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_s"?: number | null,"id"?: string,"lang": Database["public"]['Enums']["lang"],"place_id": string,"source": Database["public"]['Enums']["audio_source"],"storage_path": string,"transcript"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"duration_s"?: number | null,"id"?: string,"lang"?: Database["public"]['Enums']["lang"],"place_id"?: string,"source"?: Database["public"]['Enums']["audio_source"],"storage_path"?: string,"transcript"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audio_guides_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"booking_proofs": {
                  Row: {
                    "created_at": string,"delete_after": string,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"id": string,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["review_status"],"storage_path": string | null,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"delete_after"?: string,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["review_status"],"storage_path"?: string | null,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"delete_after"?: string,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["entity_type"],"id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["review_status"],"storage_path"?: string | null,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"consents": {
                  Row: {
                    "created_at": string,"granted": boolean,"granted_at": string | null,"id": string,"revoked_at": string | null,"type": Database["public"]['Enums']["consent_type"],"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"granted": boolean,"granted_at"?: string | null,"id"?: string,"revoked_at"?: string | null,"type": Database["public"]['Enums']["consent_type"],"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"granted"?: boolean,"granted_at"?: string | null,"id"?: string,"revoked_at"?: string | null,"type"?: Database["public"]['Enums']["consent_type"],"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"content_drafts": {
                  Row: {
                    "created_at": string,"draft_text": string,"entity_id": string,"entity_type": Database["public"]['Enums']["listing_type"],"field": string,"id": string,"lang": Database["public"]['Enums']["lang"],"reviewer_id": string | null,"status": Database["public"]['Enums']["draft_status"],"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"draft_text": string,"entity_id": string,"entity_type": Database["public"]['Enums']["listing_type"],"field": string,"id"?: string,"lang": Database["public"]['Enums']["lang"],"reviewer_id"?: string | null,"status"?: Database["public"]['Enums']["draft_status"],"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"draft_text"?: string,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["listing_type"],"field"?: string,"id"?: string,"lang"?: Database["public"]['Enums']["lang"],"reviewer_id"?: string | null,"status"?: Database["public"]['Enums']["draft_status"],"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"correction_factors": {
                  Row: {
                    "active_months": (number)[] | null,"created_at": string,"id": string,"multiplier": number,"notes": string | null,"type": Database["public"]['Enums']["correction_type"],"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active_months"?: (number)[] | null,"created_at"?: string,"id"?: string,"multiplier": number,"notes"?: string | null,"type": Database["public"]['Enums']["correction_type"],"updated_at"?: string | null
                  }
                  Update: {
                    "active_months"?: (number)[] | null,"created_at"?: string,"id"?: string,"multiplier"?: number,"notes"?: string | null,"type"?: Database["public"]['Enums']["correction_type"],"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"crowd_typical": {
                  Row: {
                    "created_at": string,"id": string,"level": Database["public"]['Enums']["crowd_level"],"place_id": string,"season": string | null,"updated_at": string | null,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"level": Database["public"]['Enums']["crowd_level"],"place_id": string,"season"?: string | null,"updated_at"?: string | null,"weekday": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"level"?: Database["public"]['Enums']["crowd_level"],"place_id"?: string,"season"?: string | null,"updated_at"?: string | null,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "crowd_typical_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"dish_translations": {
                  Row: {
                    "created_at": string,"dish_id": string,"id": string,"is_seed": boolean,"lang": Database["public"]['Enums']["lang"],"name": string,"story": string | null,"updated_at": string | null,"what_it_is": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dish_id": string,"id"?: string,"is_seed"?: boolean,"lang": Database["public"]['Enums']["lang"],"name": string,"story"?: string | null,"updated_at"?: string | null,"what_it_is"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"dish_id"?: string,"id"?: string,"is_seed"?: boolean,"lang"?: Database["public"]['Enums']["lang"],"name"?: string,"story"?: string | null,"updated_at"?: string | null,"what_it_is"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "dish_translations_dish_id_fkey"
      columns: ["dish_id"]
isOneToOne: false
      referencedRelation: "dishes"
      referencedColumns: ["id"]
    }
                  ]
                },"dishes": {
                  Row: {
                    "created_at": string,"id": string,"is_seed": boolean,"slug": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_seed"?: boolean,"slug": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_seed"?: boolean,"slug"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"dwell_events": {
                  Row: {
                    "anon_id": string,"arrived_at": string,"created_at": string,"id": string,"left_at": string | null,"place_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anon_id": string,"arrived_at": string,"created_at"?: string,"id"?: string,"left_at"?: string | null,"place_id": string
                  }
                  Update: {
                    "anon_id"?: string,"arrived_at"?: string,"created_at"?: string,"id"?: string,"left_at"?: string | null,"place_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dwell_events_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"eateries": {
                  Row: {
                    "authenticity": Database["public"]['Enums']["eatery_authenticity"] | null,"created_at": string,"diet_flags": NonNullable<Json>,"food_apps": NonNullable<Json>,"id": string,"is_seed": boolean,"is_verified": boolean,"last_verified_at": string | null,"location": unknown,"menu": Json | null,"owner_id": string | null,"phone": string | null,"price_for_two": number | null,"service_style": Database["public"]['Enums']["service_style"] | null,"slug": string,"status": Database["public"]['Enums']["content_status"],"taluka_id": string,"updated_at": string | null,"vibe_tags": (string)[],"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "authenticity"?: Database["public"]['Enums']["eatery_authenticity"] | null,"created_at"?: string,"diet_flags"?: NonNullable<Json>,"food_apps"?: NonNullable<Json>,"id"?: string,"is_seed"?: boolean,"is_verified"?: boolean,"last_verified_at"?: string | null,"location": unknown,"menu"?: Json | null,"owner_id"?: string | null,"phone"?: string | null,"price_for_two"?: number | null,"service_style"?: Database["public"]['Enums']["service_style"] | null,"slug": string,"status"?: Database["public"]['Enums']["content_status"],"taluka_id": string,"updated_at"?: string | null,"vibe_tags"?: (string)[],"whatsapp"?: string | null
                  }
                  Update: {
                    "authenticity"?: Database["public"]['Enums']["eatery_authenticity"] | null,"created_at"?: string,"diet_flags"?: NonNullable<Json>,"food_apps"?: NonNullable<Json>,"id"?: string,"is_seed"?: boolean,"is_verified"?: boolean,"last_verified_at"?: string | null,"location"?: unknown,"menu"?: Json | null,"owner_id"?: string | null,"phone"?: string | null,"price_for_two"?: number | null,"service_style"?: Database["public"]['Enums']["service_style"] | null,"slug"?: string,"status"?: Database["public"]['Enums']["content_status"],"taluka_id"?: string,"updated_at"?: string | null,"vibe_tags"?: (string)[],"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "eateries_taluka_id_fkey"
      columns: ["taluka_id"]
isOneToOne: false
      referencedRelation: "talukas"
      referencedColumns: ["id"]
    }
                  ]
                },"eatery_dishes": {
                  Row: {
                    "created_at": string,"dish_id": string,"eatery_id": string,"id": string,"is_best_for": boolean,"is_signature": boolean,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dish_id": string,"eatery_id": string,"id"?: string,"is_best_for"?: boolean,"is_signature"?: boolean,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"dish_id"?: string,"eatery_id"?: string,"id"?: string,"is_best_for"?: boolean,"is_signature"?: boolean,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "eatery_dishes_dish_id_fkey"
      columns: ["dish_id"]
isOneToOne: false
      referencedRelation: "dishes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eatery_dishes_eatery_id_fkey"
      columns: ["eatery_id"]
isOneToOne: false
      referencedRelation: "eateries"
      referencedColumns: ["id"]
    }
                  ]
                },"eatery_hours": {
                  Row: {
                    "closes": string | null,"created_at": string,"eatery_id": string,"hours_unknown": boolean,"id": string,"opens": string | null,"updated_at": string | null,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "closes"?: string | null,"created_at"?: string,"eatery_id": string,"hours_unknown"?: boolean,"id"?: string,"opens"?: string | null,"updated_at"?: string | null,"weekday": number
                  }
                  Update: {
                    "closes"?: string | null,"created_at"?: string,"eatery_id"?: string,"hours_unknown"?: boolean,"id"?: string,"opens"?: string | null,"updated_at"?: string | null,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "eatery_hours_eatery_id_fkey"
      columns: ["eatery_id"]
isOneToOne: false
      referencedRelation: "eateries"
      referencedColumns: ["id"]
    }
                  ]
                },"eatery_translations": {
                  Row: {
                    "created_at": string,"description": string | null,"eatery_id": string,"id": string,"is_seed": boolean,"lang": Database["public"]['Enums']["lang"],"name": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"eatery_id": string,"id"?: string,"is_seed"?: boolean,"lang": Database["public"]['Enums']["lang"],"name": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"eatery_id"?: string,"id"?: string,"is_seed"?: boolean,"lang"?: Database["public"]['Enums']["lang"],"name"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "eatery_translations_eatery_id_fkey"
      columns: ["eatery_id"]
isOneToOne: false
      referencedRelation: "eateries"
      referencedColumns: ["id"]
    }
                  ]
                },"events_calendar": {
                  Row: {
                    "created_at": string,"from_date": string,"id": string,"impact": NonNullable<Json>,"name_en": string,"name_hi": string | null,"name_mr": string | null,"taluka_id": string | null,"to_date": string,"type": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"from_date": string,"id"?: string,"impact"?: NonNullable<Json>,"name_en": string,"name_hi"?: string | null,"name_mr"?: string | null,"taluka_id"?: string | null,"to_date": string,"type": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"from_date"?: string,"id"?: string,"impact"?: NonNullable<Json>,"name_en"?: string,"name_hi"?: string | null,"name_mr"?: string | null,"taluka_id"?: string | null,"to_date"?: string,"type"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_calendar_taluka_id_fkey"
      columns: ["taluka_id"]
isOneToOne: false
      referencedRelation: "talukas"
      referencedColumns: ["id"]
    }
                  ]
                },"group_votes": {
                  Row: {
                    "created_at": string,"entity_id": string,"id": string,"trip_id": string,"updated_at": string | null,"vote": string,"voter_name": string | null,"voter_token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entity_id": string,"id"?: string,"trip_id": string,"updated_at"?: string | null,"vote": string,"voter_name"?: string | null,"voter_token": string
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string,"id"?: string,"trip_id"?: string,"updated_at"?: string | null,"vote"?: string,"voter_name"?: string | null,"voter_token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_votes_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"matrix_points": {
                  Row: {
                    "created_at": string,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"id": string,"location": unknown,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"id"?: string,"location": unknown,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["entity_type"],"id"?: string,"location"?: unknown,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"owner_claims": {
                  Row: {
                    "created_at": string,"email": string,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"id": string,"reviewed_at": string | null,"reviewed_by": string | null,"status": Database["public"]['Enums']["review_status"],"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["review_status"],"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["entity_type"],"id"?: string,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["review_status"],"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"photos": {
                  Row: {
                    "created_at": string,"entity_id": string,"entity_type": Database["public"]['Enums']["listing_type"],"height": number | null,"id": string,"is_hero": boolean,"lqip": string | null,"storage_path": string,"updated_at": string | null,"uploaded_by": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entity_id": string,"entity_type": Database["public"]['Enums']["listing_type"],"height"?: number | null,"id"?: string,"is_hero"?: boolean,"lqip"?: string | null,"storage_path": string,"updated_at"?: string | null,"uploaded_by": string,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["listing_type"],"height"?: number | null,"id"?: string,"is_hero"?: boolean,"lqip"?: string | null,"storage_path"?: string,"updated_at"?: string | null,"uploaded_by"?: string,"width"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"place_embeddings": {
                  Row: {
                    "created_at": string,"embedding": string,"id": string,"place_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"embedding": string,"id"?: string,"place_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"embedding"?: string,"id"?: string,"place_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "place_embeddings_place_id_fkey"
      columns: ["place_id"]
isOneToOne: true
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"place_hours": {
                  Row: {
                    "closes": string | null,"created_at": string,"hours_unknown": boolean,"id": string,"opens": string | null,"place_id": string,"updated_at": string | null,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "closes"?: string | null,"created_at"?: string,"hours_unknown"?: boolean,"id"?: string,"opens"?: string | null,"place_id": string,"updated_at"?: string | null,"weekday": number
                  }
                  Update: {
                    "closes"?: string | null,"created_at"?: string,"hours_unknown"?: boolean,"id"?: string,"opens"?: string | null,"place_id"?: string,"updated_at"?: string | null,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "place_hours_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"place_seasonal": {
                  Row: {
                    "created_at": string,"from_month": number,"id": string,"place_id": string,"season": Database["public"]['Enums']["season"],"to_month": number,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"from_month": number,"id"?: string,"place_id": string,"season": Database["public"]['Enums']["season"],"to_month": number,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"from_month"?: number,"id"?: string,"place_id"?: string,"season"?: Database["public"]['Enums']["season"],"to_month"?: number,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "place_seasonal_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"place_tide_rules": {
                  Row: {
                    "created_at": string,"id": string,"max_safe_height_m": number | null,"place_id": string,"rule_text": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"max_safe_height_m"?: number | null,"place_id": string,"rule_text"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"max_safe_height_m"?: number | null,"place_id"?: string,"rule_text"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "place_tide_rules_place_id_fkey"
      columns: ["place_id"]
isOneToOne: true
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"place_translations": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"created_at": string,"donts": string | null,"dos": string | null,"history": string | null,"id": string,"is_seed": boolean,"lang": Database["public"]['Enums']["lang"],"name": string,"place_id": string,"safety_text": string | null,"short_story": string | null,"significance": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"donts"?: string | null,"dos"?: string | null,"history"?: string | null,"id"?: string,"is_seed"?: boolean,"lang": Database["public"]['Enums']["lang"],"name": string,"place_id": string,"safety_text"?: string | null,"short_story"?: string | null,"significance"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"donts"?: string | null,"dos"?: string | null,"history"?: string | null,"id"?: string,"is_seed"?: boolean,"lang"?: Database["public"]['Enums']["lang"],"name"?: string,"place_id"?: string,"safety_text"?: string | null,"short_story"?: string | null,"significance"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "place_translations_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"places": {
                  Row: {
                    "best_time_text": string | null,"category": Database["public"]['Enums']["place_category"],"created_at": string,"entry_fee_text": string | null,"food_delivery": NonNullable<Json>,"how_to_reach_text": string | null,"id": string,"is_hidden_gem": boolean,"is_seed": boolean,"is_tide_dependent": boolean,"last_verified_at": string | null,"location": unknown,"monsoon_reason": string | null,"monsoon_status": Database["public"]['Enums']["monsoon_status"],"nearest_bus_stop_text": string | null,"nearest_station_text": string | null,"next_recheck_at": string | null,"slug": string,"status": Database["public"]['Enums']["content_status"],"taluka_id": string,"tide_station_id": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "best_time_text"?: string | null,"category": Database["public"]['Enums']["place_category"],"created_at"?: string,"entry_fee_text"?: string | null,"food_delivery"?: NonNullable<Json>,"how_to_reach_text"?: string | null,"id"?: string,"is_hidden_gem"?: boolean,"is_seed"?: boolean,"is_tide_dependent"?: boolean,"last_verified_at"?: string | null,"location": unknown,"monsoon_reason"?: string | null,"monsoon_status"?: Database["public"]['Enums']["monsoon_status"],"nearest_bus_stop_text"?: string | null,"nearest_station_text"?: string | null,"next_recheck_at"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["content_status"],"taluka_id": string,"tide_station_id"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "best_time_text"?: string | null,"category"?: Database["public"]['Enums']["place_category"],"created_at"?: string,"entry_fee_text"?: string | null,"food_delivery"?: NonNullable<Json>,"how_to_reach_text"?: string | null,"id"?: string,"is_hidden_gem"?: boolean,"is_seed"?: boolean,"is_tide_dependent"?: boolean,"last_verified_at"?: string | null,"location"?: unknown,"monsoon_reason"?: string | null,"monsoon_status"?: Database["public"]['Enums']["monsoon_status"],"nearest_bus_stop_text"?: string | null,"nearest_station_text"?: string | null,"next_recheck_at"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["content_status"],"taluka_id"?: string,"tide_station_id"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "places_taluka_id_fkey"
      columns: ["taluka_id"]
isOneToOne: false
      referencedRelation: "talukas"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "places_tide_station_fk"
      columns: ["tide_station_id"]
isOneToOne: false
      referencedRelation: "tide_stations"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"id": string,"language": Database["public"]['Enums']["lang"],"theme": Database["public"]['Enums']["theme"],"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"id": string,"language"?: Database["public"]['Enums']["lang"],"theme"?: Database["public"]['Enums']["theme"],"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"id"?: string,"language"?: Database["public"]['Enums']["lang"],"theme"?: Database["public"]['Enums']["theme"],"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"published_routes": {
                  Row: {
                    "created_at": string,"id": string,"reviewed_by": string | null,"status": string,"trip_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"reviewed_by"?: string | null,"status"?: string,"trip_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"reviewed_by"?: string | null,"status"?: string,"trip_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "published_routes_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: true
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"qr_codes": {
                  Row: {
                    "code": string,"created_at": string,"entity_id": string,"entity_type": Database["public"]['Enums']["qr_entity_type"],"id": string,"installed_at": string | null,"permission_body": string | null,"permission_status": string,"sponsor_id": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"entity_id": string,"entity_type": Database["public"]['Enums']["qr_entity_type"],"id"?: string,"installed_at"?: string | null,"permission_body"?: string | null,"permission_status"?: string,"sponsor_id"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["qr_entity_type"],"id"?: string,"installed_at"?: string | null,"permission_body"?: string | null,"permission_status"?: string,"sponsor_id"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "qr_codes_sponsor_id_fkey"
      columns: ["sponsor_id"]
isOneToOne: false
      referencedRelation: "sponsors"
      referencedColumns: ["id"]
    }
                  ]
                },"qr_scans": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"lang": Database["public"]['Enums']["lang"] | null,"lat": number | null,"lng": number | null,"scanned_at": string,"session_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"lang"?: Database["public"]['Enums']["lang"] | null,"lat"?: number | null,"lng"?: number | null,"scanned_at"?: string,"session_hash": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"lang"?: Database["public"]['Enums']["lang"] | null,"lat"?: number | null,"lng"?: number | null,"scanned_at"?: string,"session_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "qr_scans_code_fkey"
      columns: ["code"]
isOneToOne: false
      referencedRelation: "qr_codes"
      referencedColumns: ["code"]
    }
                  ]
                },"regions": {
                  Row: {
                    "code_prefix": string,"created_at": string,"id": string,"name": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code_prefix": string,"created_at"?: string,"id"?: string,"name": string,"updated_at"?: string | null
                  }
                  Update: {
                    "code_prefix"?: string,"created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "assigned_to": string | null,"created_at": string,"entity_id": string,"entity_type": Database["public"]['Enums']["qr_entity_type"],"id": string,"photo_id": string | null,"qr_code": string | null,"status": Database["public"]['Enums']["report_status"],"text": string | null,"type": Database["public"]['Enums']["report_type"],"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to"?: string | null,"created_at"?: string,"entity_id": string,"entity_type": Database["public"]['Enums']["qr_entity_type"],"id"?: string,"photo_id"?: string | null,"qr_code"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"text"?: string | null,"type": Database["public"]['Enums']["report_type"],"updated_at"?: string | null
                  }
                  Update: {
                    "assigned_to"?: string | null,"created_at"?: string,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["qr_entity_type"],"id"?: string,"photo_id"?: string | null,"qr_code"?: string | null,"status"?: Database["public"]['Enums']["report_status"],"text"?: string | null,"type"?: Database["public"]['Enums']["report_type"],"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_photo_id_fkey"
      columns: ["photo_id"]
isOneToOne: false
      referencedRelation: "photos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_qr_code_fkey"
      columns: ["qr_code"]
isOneToOne: false
      referencedRelation: "qr_codes"
      referencedColumns: ["code"]
    }
                  ]
                },"review_photos": {
                  Row: {
                    "created_at": string,"height": number | null,"id": string,"lqip": string | null,"review_id": string,"storage_path": string,"updated_at": string | null,"user_id": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"height"?: number | null,"id"?: string,"lqip"?: string | null,"review_id": string,"storage_path": string,"updated_at"?: string | null,"user_id": string,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"height"?: number | null,"id"?: string,"lqip"?: string | null,"review_id"?: string,"storage_path"?: string,"updated_at"?: string | null,"user_id"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_photos_review_id_fkey"
      columns: ["review_id"]
isOneToOne: false
      referencedRelation: "reviews"
      referencedColumns: ["id"]
    }
                  ]
                },"review_summaries": {
                  Row: {
                    "created_at": string,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"generated_at": string,"id": string,"lang": Database["public"]['Enums']["lang"],"summary": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"generated_at"?: string,"id"?: string,"lang": Database["public"]['Enums']["lang"],"summary": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["entity_type"],"generated_at"?: string,"id"?: string,"lang"?: Database["public"]['Enums']["lang"],"summary"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"reviews": {
                  Row: {
                    "created_at": string,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"group_type": Database["public"]['Enums']["group_type"],"id": string,"moderation_status": Database["public"]['Enums']["review_status"],"photo_ids": (string)[],"text": string | null,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"group_type": Database["public"]['Enums']["group_type"],"id"?: string,"moderation_status"?: Database["public"]['Enums']["review_status"],"photo_ids"?: (string)[],"text"?: string | null,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["entity_type"],"group_type"?: Database["public"]['Enums']["group_type"],"id"?: string,"moderation_status"?: Database["public"]['Enums']["review_status"],"photo_ids"?: (string)[],"text"?: string | null,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"road_segments_flags": {
                  Row: {
                    "created_at": string,"excluded": boolean,"flag": Database["public"]['Enums']["correction_type"],"id": string,"osm_way_id": number,"source": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"excluded"?: boolean,"flag": Database["public"]['Enums']["correction_type"],"id"?: string,"osm_way_id": number,"source"?: string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"excluded"?: boolean,"flag"?: Database["public"]['Enums']["correction_type"],"id"?: string,"osm_way_id"?: number,"source"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"route_stats": {
                  Row: {
                    "computed_at": string,"created_at": string,"id": string,"kind": string,"score": number,"stops": (string)[],"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "computed_at"?: string,"created_at"?: string,"id"?: string,"kind": string,"score": number,"stops": (string)[],"updated_at"?: string | null
                  }
                  Update: {
                    "computed_at"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"score"?: number,"stops"?: (string)[],"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"sponsors": {
                  Row: {
                    "created_at": string,"entity_id": string | null,"entity_type": Database["public"]['Enums']["entity_type"] | null,"id": string,"name": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entity_id"?: string | null,"entity_type"?: Database["public"]['Enums']["entity_type"] | null,"id"?: string,"name": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string | null,"entity_type"?: Database["public"]['Enums']["entity_type"] | null,"id"?: string,"name"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"stay_offers": {
                  Row: {
                    "affiliate_network": string | null,"created_at": string,"deep_link": string,"fetched_at": string | null,"id": string,"live_price": number | null,"provider": string,"stay_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliate_network"?: string | null,"created_at"?: string,"deep_link": string,"fetched_at"?: string | null,"id"?: string,"live_price"?: number | null,"provider": string,"stay_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "affiliate_network"?: string | null,"created_at"?: string,"deep_link"?: string,"fetched_at"?: string | null,"id"?: string,"live_price"?: number | null,"provider"?: string,"stay_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stay_offers_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "stays"
      referencedColumns: ["id"]
    }
                  ]
                },"stay_translations": {
                  Row: {
                    "created_at": string,"description": string | null,"id": string,"is_seed": boolean,"lang": Database["public"]['Enums']["lang"],"name": string,"stay_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_seed"?: boolean,"lang": Database["public"]['Enums']["lang"],"name": string,"stay_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"id"?: string,"is_seed"?: boolean,"lang"?: Database["public"]['Enums']["lang"],"name"?: string,"stay_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stay_translations_stay_id_fkey"
      columns: ["stay_id"]
isOneToOne: false
      referencedRelation: "stays"
      referencedColumns: ["id"]
    }
                  ]
                },"stays": {
                  Row: {
                    "amenities": NonNullable<Json>,"claimed_at": string | null,"created_at": string,"food_at_stay": NonNullable<Json>,"id": string,"is_seed": boolean,"is_verified": boolean,"last_verified_at": string | null,"location": unknown,"network_strength": NonNullable<Json>,"owner_id": string | null,"phone": string | null,"price_max": number | null,"price_min": number | null,"price_source": Database["public"]['Enums']["price_source"] | null,"service_style": Database["public"]['Enums']["service_style"] | null,"slug": string,"status": Database["public"]['Enums']["content_status"],"taluka_id": string,"updated_at": string | null,"vibe_tags": (string)[],"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amenities"?: NonNullable<Json>,"claimed_at"?: string | null,"created_at"?: string,"food_at_stay"?: NonNullable<Json>,"id"?: string,"is_seed"?: boolean,"is_verified"?: boolean,"last_verified_at"?: string | null,"location": unknown,"network_strength"?: NonNullable<Json>,"owner_id"?: string | null,"phone"?: string | null,"price_max"?: number | null,"price_min"?: number | null,"price_source"?: Database["public"]['Enums']["price_source"] | null,"service_style"?: Database["public"]['Enums']["service_style"] | null,"slug": string,"status"?: Database["public"]['Enums']["content_status"],"taluka_id": string,"updated_at"?: string | null,"vibe_tags"?: (string)[],"whatsapp"?: string | null
                  }
                  Update: {
                    "amenities"?: NonNullable<Json>,"claimed_at"?: string | null,"created_at"?: string,"food_at_stay"?: NonNullable<Json>,"id"?: string,"is_seed"?: boolean,"is_verified"?: boolean,"last_verified_at"?: string | null,"location"?: unknown,"network_strength"?: NonNullable<Json>,"owner_id"?: string | null,"phone"?: string | null,"price_max"?: number | null,"price_min"?: number | null,"price_source"?: Database["public"]['Enums']["price_source"] | null,"service_style"?: Database["public"]['Enums']["service_style"] | null,"slug"?: string,"status"?: Database["public"]['Enums']["content_status"],"taluka_id"?: string,"updated_at"?: string | null,"vibe_tags"?: (string)[],"whatsapp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stays_taluka_id_fkey"
      columns: ["taluka_id"]
isOneToOne: false
      referencedRelation: "talukas"
      referencedColumns: ["id"]
    }
                  ]
                },"sub_scores": {
                  Row: {
                    "created_at": string,"dimension": Database["public"]['Enums']["sub_score_dimension"],"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"id": string,"score": number,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dimension": Database["public"]['Enums']["sub_score_dimension"],"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"id"?: string,"score": number,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"dimension"?: Database["public"]['Enums']["sub_score_dimension"],"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["entity_type"],"id"?: string,"score"?: number,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"talukas": {
                  Row: {
                    "boundary": unknown,"created_at": string,"id": string,"name_en": string,"name_hi": string,"name_mr": string,"pack_url": string | null,"pack_version": string | null,"region_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "boundary"?: unknown,"created_at"?: string,"id"?: string,"name_en": string,"name_hi": string,"name_mr": string,"pack_url"?: string | null,"pack_version"?: string | null,"region_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "boundary"?: unknown,"created_at"?: string,"id"?: string,"name_en"?: string,"name_hi"?: string,"name_mr"?: string,"pack_url"?: string | null,"pack_version"?: string | null,"region_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "talukas_region_id_fkey"
      columns: ["region_id"]
isOneToOne: false
      referencedRelation: "regions"
      referencedColumns: ["id"]
    }
                  ]
                },"tide_cache": {
                  Row: {
                    "created_at": string,"curve": Json | null,"date": string,"extremes": NonNullable<Json>,"fetched_at": string,"id": string,"provider": Database["public"]['Enums']["tide_provider"],"station_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"curve"?: Json | null,"date": string,"extremes": NonNullable<Json>,"fetched_at"?: string,"id"?: string,"provider": Database["public"]['Enums']["tide_provider"],"station_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"curve"?: Json | null,"date"?: string,"extremes"?: NonNullable<Json>,"fetched_at"?: string,"id"?: string,"provider"?: Database["public"]['Enums']["tide_provider"],"station_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tide_cache_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "tide_stations"
      referencedColumns: ["id"]
    }
                  ]
                },"tide_stations": {
                  Row: {
                    "created_at": string,"id": string,"location": unknown,"name": string,"provider_station_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"location": unknown,"name": string,"provider_station_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"location"?: unknown,"name"?: string,"provider_station_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"trails": {
                  Row: {
                    "created_at": string,"difficulty": string | null,"geometry": unknown,"gpx_storage_path": string | null,"id": string,"name_en": string,"name_hi": string | null,"name_mr": string | null,"source": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"difficulty"?: string | null,"geometry"?: unknown,"gpx_storage_path"?: string | null,"id"?: string,"name_en": string,"name_hi"?: string | null,"name_mr"?: string | null,"source": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"difficulty"?: string | null,"geometry"?: unknown,"gpx_storage_path"?: string | null,"id"?: string,"name_en"?: string,"name_hi"?: string | null,"name_mr"?: string | null,"source"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"travel_matrix": {
                  Row: {
                    "computed_at": string,"distance_m": number,"duration_corrected_s": number,"duration_s": number,"from_point_id": string,"route_shape": string | null,"to_point_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "computed_at"?: string,"distance_m": number,"duration_corrected_s": number,"duration_s": number,"from_point_id": string,"route_shape"?: string | null,"to_point_id": string
                  }
                  Update: {
                    "computed_at"?: string,"distance_m"?: number,"duration_corrected_s"?: number,"duration_s"?: number,"from_point_id"?: string,"route_shape"?: string | null,"to_point_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "travel_matrix_from_point_id_fkey"
      columns: ["from_point_id"]
isOneToOne: false
      referencedRelation: "matrix_points"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "travel_matrix_to_point_id_fkey"
      columns: ["to_point_id"]
isOneToOne: false
      referencedRelation: "matrix_points"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_budget": {
                  Row: {
                    "activities": number,"created_at": string,"entry": number,"food": number,"fuel": number,"fuel_price": number | null,"id": string,"people": number,"stay": number,"trip_id": string,"updated_at": string | null,"vehicle_mileage_kmpl": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activities"?: number,"created_at"?: string,"entry"?: number,"food"?: number,"fuel"?: number,"fuel_price"?: number | null,"id"?: string,"people"?: number,"stay"?: number,"trip_id": string,"updated_at"?: string | null,"vehicle_mileage_kmpl"?: number | null
                  }
                  Update: {
                    "activities"?: number,"created_at"?: string,"entry"?: number,"food"?: number,"fuel"?: number,"fuel_price"?: number | null,"id"?: string,"people"?: number,"stay"?: number,"trip_id"?: string,"updated_at"?: string | null,"vehicle_mileage_kmpl"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_budget_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: true
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trip_stops": {
                  Row: {
                    "arrive_at": string | null,"created_at": string,"day": number,"depart_at": string | null,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"id": string,"kind": Database["public"]['Enums']["stop_kind"],"order": number,"reason_en": string | null,"reason_hi": string | null,"reason_mr": string | null,"travel_from_prev_s": number | null,"trip_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "arrive_at"?: string | null,"created_at"?: string,"day": number,"depart_at"?: string | null,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"id"?: string,"kind": Database["public"]['Enums']["stop_kind"],"order": number,"reason_en"?: string | null,"reason_hi"?: string | null,"reason_mr"?: string | null,"travel_from_prev_s"?: number | null,"trip_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "arrive_at"?: string | null,"created_at"?: string,"day"?: number,"depart_at"?: string | null,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["entity_type"],"id"?: string,"kind"?: Database["public"]['Enums']["stop_kind"],"order"?: number,"reason_en"?: string | null,"reason_hi"?: string | null,"reason_mr"?: string | null,"travel_from_prev_s"?: number | null,"trip_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_stops_trip_id_fkey"
      columns: ["trip_id"]
isOneToOne: false
      referencedRelation: "trips"
      referencedColumns: ["id"]
    }
                  ]
                },"trips": {
                  Row: {
                    "budget": number | null,"created_at": string,"days": number,"group_type": Database["public"]['Enums']["group_type"] | null,"id": string,"interests": (string)[],"is_ready_made": boolean,"owner_id": string,"pace": Database["public"]['Enums']["trip_pace"],"share_token": string | null,"standout": boolean,"start_point": Json | null,"status": Database["public"]['Enums']["trip_status"],"title": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "budget"?: number | null,"created_at"?: string,"days": number,"group_type"?: Database["public"]['Enums']["group_type"] | null,"id"?: string,"interests"?: (string)[],"is_ready_made"?: boolean,"owner_id": string,"pace"?: Database["public"]['Enums']["trip_pace"],"share_token"?: string | null,"standout"?: boolean,"start_point"?: Json | null,"status"?: Database["public"]['Enums']["trip_status"],"title": string,"updated_at"?: string | null
                  }
                  Update: {
                    "budget"?: number | null,"created_at"?: string,"days"?: number,"group_type"?: Database["public"]['Enums']["group_type"] | null,"id"?: string,"interests"?: (string)[],"is_ready_made"?: boolean,"owner_id"?: string,"pace"?: Database["public"]['Enums']["trip_pace"],"share_token"?: string | null,"standout"?: boolean,"start_point"?: Json | null,"status"?: Database["public"]['Enums']["trip_status"],"title"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"user_preferences": {
                  Row: {
                    "budget_level": string | null,"created_at": string,"diet": string | null,"group_type": Database["public"]['Enums']["group_type"] | null,"id": string,"past_trip_ids": (string)[],"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "budget_level"?: string | null,"created_at"?: string,"diet"?: string | null,"group_type"?: Database["public"]['Enums']["group_type"] | null,"id"?: string,"past_trip_ids"?: (string)[],"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "budget_level"?: string | null,"created_at"?: string,"diet"?: string | null,"group_type"?: Database["public"]['Enums']["group_type"] | null,"id"?: string,"past_trip_ids"?: (string)[],"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"entity_id": string | null,"entity_type": Database["public"]['Enums']["listing_type"] | null,"id": string,"role": Database["public"]['Enums']["app_role"],"taluka_id": string | null,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entity_id"?: string | null,"entity_type"?: Database["public"]['Enums']["listing_type"] | null,"id"?: string,"role": Database["public"]['Enums']["app_role"],"taluka_id"?: string | null,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string | null,"entity_type"?: Database["public"]['Enums']["listing_type"] | null,"id"?: string,"role"?: Database["public"]['Enums']["app_role"],"taluka_id"?: string | null,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_roles_taluka_id_fkey"
      columns: ["taluka_id"]
isOneToOne: false
      referencedRelation: "talukas"
      referencedColumns: ["id"]
    }
                  ]
                },"utility_pois": {
                  Row: {
                    "created_at": string,"id": string,"location": unknown,"name": string | null,"osm_id": number | null,"phone": string | null,"source": string,"taluka_id": string | null,"type": Database["public"]['Enums']["utility_type"],"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"location": unknown,"name"?: string | null,"osm_id"?: number | null,"phone"?: string | null,"source": string,"taluka_id"?: string | null,"type": Database["public"]['Enums']["utility_type"],"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"location"?: unknown,"name"?: string | null,"osm_id"?: number | null,"phone"?: string | null,"source"?: string,"taluka_id"?: string | null,"type"?: Database["public"]['Enums']["utility_type"],"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "utility_pois_taluka_id_fkey"
      columns: ["taluka_id"]
isOneToOne: false
      referencedRelation: "talukas"
      referencedColumns: ["id"]
    }
                  ]
                },"verdict_agg": {
                  Row: {
                    "counts": (number)[],"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"group_type": Database["public"]['Enums']["group_type"],"is_new": boolean,"total": number,"updated_at": string | null,"winner_level": number | null,"winner_pct": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "counts"?: (number)[],"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"group_type": Database["public"]['Enums']["group_type"],"is_new"?: boolean,"total"?: number,"updated_at"?: string | null,"winner_level"?: number | null,"winner_pct"?: number | null
                  }
                  Update: {
                    "counts"?: (number)[],"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["entity_type"],"group_type"?: Database["public"]['Enums']["group_type"],"is_new"?: boolean,"total"?: number,"updated_at"?: string | null,"winner_level"?: number | null,"winner_pct"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"verdicts": {
                  Row: {
                    "created_at": string,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"group_type": Database["public"]['Enums']["group_type"],"id": string,"level": number,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"group_type": Database["public"]['Enums']["group_type"],"id"?: string,"level": number,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["entity_type"],"group_type"?: Database["public"]['Enums']["group_type"],"id"?: string,"level"?: number,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"verified_visits": {
                  Row: {
                    "created_at": string,"distance_m": number | null,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"id": string,"method": Database["public"]['Enums']["visit_method"],"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"distance_m"?: number | null,"entity_id": string,"entity_type": Database["public"]['Enums']["entity_type"],"id"?: string,"method": Database["public"]['Enums']["visit_method"],"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"distance_m"?: number | null,"entity_id"?: string,"entity_type"?: Database["public"]['Enums']["entity_type"],"id"?: string,"method"?: Database["public"]['Enums']["visit_method"],"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"verifier_notes": {
                  Row: {
                    "author_id": string | null,"created_at": string,"id": string,"notes": string,"place_id": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"created_at"?: string,"id"?: string,"notes": string,"place_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "author_id"?: string | null,"created_at"?: string,"id"?: string,"notes"?: string,"place_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "verifier_notes_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"weather_cache": {
                  Row: {
                    "created_at": string,"fetched_at": string,"id": string,"payload": NonNullable<Json>,"point_id": string,"summary": Json | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"fetched_at"?: string,"id"?: string,"payload": NonNullable<Json>,"point_id": string,"summary"?: Json | null,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"fetched_at"?: string,"id"?: string,"payload"?: NonNullable<Json>,"point_id"?: string,"summary"?: Json | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "weather_cache_point_id_fkey"
      columns: ["point_id"]
isOneToOne: false
      referencedRelation: "weather_points"
      referencedColumns: ["id"]
    }
                  ]
                },"weather_points": {
                  Row: {
                    "created_at": string,"id": string,"location": unknown,"name": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"location": unknown,"name": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"location"?: unknown,"name"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "verdict_agg_all": {
                  Row: {
                    "counts": (number)[] | null,"entity_id": string | null,"entity_type": Database["public"]['Enums']["entity_type"] | null,"is_new": boolean | null,"total": number | null,"winner_level": number | null,"winner_pct": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "approve_listing":
{ Args: { "_id": string,"_type": Database["public"]['Enums']["listing_type"] }; Returns: undefined
                           },
"cast_group_vote":
{ Args: { "_entity_id": string,"_token": string,"_vote": string,"_voter_name": string,"_voter_token": string }; Returns: undefined
                           },
"create_qr_code":
{ Args: { "_id": string,"_type": Database["public"]['Enums']["qr_entity_type"] }; Returns: string
                           },
"get_shared_trip":
{ Args: { "_token": string }; Returns: Json
                           },
"map_pins":
{ Args: { "categories"?: (Database["public"]['Enums']["place_category"])[],"kinds"?: (string)[],"max_lat": number,"max_lon": number,"min_lat": number,"min_lon": number,"open_now"?: boolean }; Returns: {
              "category": string,"id": string,"kind": string,"lat": number,"lon": number,"name_en": string,"name_hi": string,"name_mr": string,"slug": string,"tide_station_id": string
            }[]
                           },
"map_search":
{ Args: { "q": string }; Returns: {
              "kind": string,"lang": string,"lat": number,"lon": number,"name": string,"slug": string
            }[]
                           },
"map_utilities":
{ Args: { "max_lat": number,"max_lon": number,"min_lat": number,"min_lon": number,"types": (Database["public"]['Enums']["utility_type"])[] }; Returns: {
              "id": string,"lat": number,"lon": number,"name": string,"phone": string,"type": string
            }[]
                           },
"qr_near_me":
{ Args: { "_code": string }; Returns: {
              "distance_m": number,"kind": string,"minutes": number,"name_en": string,"name_hi": string,"name_mr": string,"phone": string,"slug": string,"sub": string
            }[]
                           },
"qr_record_scan":
{ Args: { "_code": string,"_lang"?: Database["public"]['Enums']["lang"],"_lat"?: number,"_lng"?: number,"_session_hash": string }; Returns: undefined
                           },
"qr_verify_visit":
{ Args: { "_code": string,"_lat": number,"_lng": number }; Returns: {
              "distance_m": number,"verified": boolean
            }[]
                           },
"review_booking_proof":
{ Args: { "_approve": boolean,"_proof": string }; Returns: undefined
                           },
"review_owner_claim":
{ Args: { "_approve": boolean,"_claim": string }; Returns: undefined
                           },
"sub_score_summary":
{ Args: { "_id": string,"_type": Database["public"]['Enums']["entity_type"] }; Returns: {
              "avg_score": number,"dimension": string,"n": number
            }[]
                           },
"taluka_at":
{ Args: { "lat": number,"lon": number }; Returns: string
                           },
"tide_station_coords":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"lat": number,"lon": number,"provider_station_id": string
            }[]
                           },
"weather_point_coords":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"lat": number,"lon": number,"name": string
            }[]
                           }
          }
          Enums: {
            "ai_action_status": "proposed"|"applied"|"discarded","alert_type": "road_condition"|"ghat"|"landslide"|"closure","app_role": "user"|"verifier"|"reviewer"|"owner"|"admin","audio_source": "tts"|"recorded","consent_type": "dwell_time"|"push"|"ai_processing","content_status": "draft"|"in_review"|"published","correction_type": "ghat"|"coastal"|"monsoon","crowd_level": "empty"|"calm"|"busy","draft_status": "draft"|"approved"|"rejected","eatery_authenticity": "home_style"|"local_legend"|"tourist_oriented","entity_type": "place"|"stay"|"eatery","group_type": "family"|"couple"|"solo"|"friends","lang": "en"|"hi"|"mr","listing_type": "place"|"stay"|"eatery"|"dish","monsoon_status": "open"|"risky"|"closed","place_category": "beach"|"fort"|"temple"|"waterfall"|"viewpoint"|"backwater"|"cave"|"museum"|"village"|"market"|"orchard","price_source": "owner"|"agoda"|"affiliate","qr_entity_type": "place"|"stay"|"eatery"|"station"|"bus_stand","report_status": "new"|"triaged"|"fixed"|"rejected","report_type": "broken_qr"|"garbage"|"unsafe_spot"|"wrong_info","review_status": "pending"|"approved"|"rejected","season": "turtle_nesting"|"mango"|"firefly"|"waterfall","service_style": "homely"|"professional","stop_kind": "place"|"stay"|"meal","sub_score_dimension": "taste"|"authenticity"|"hygiene"|"value"|"cleanliness"|"host"|"location","theme": "system"|"light"|"dark","tide_provider": "tidesatlas"|"tidecheck","trip_pace": "relaxed"|"balanced"|"packed","trip_status": "draft"|"saved"|"completed","utility_type": "fuel"|"atm"|"hospital"|"pharmacy"|"police"|"toilet"|"ev_charger"|"mechanic"|"bus_stand"|"railway_station"|"ferry_jetty","visit_method": "qr_gps"|"booking_proof"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "ai_action_status": ["proposed", "applied", "discarded"],"alert_type": ["road_condition", "ghat", "landslide", "closure"],"app_role": ["user", "verifier", "reviewer", "owner", "admin"],"audio_source": ["tts", "recorded"],"consent_type": ["dwell_time", "push", "ai_processing"],"content_status": ["draft", "in_review", "published"],"correction_type": ["ghat", "coastal", "monsoon"],"crowd_level": ["empty", "calm", "busy"],"draft_status": ["draft", "approved", "rejected"],"eatery_authenticity": ["home_style", "local_legend", "tourist_oriented"],"entity_type": ["place", "stay", "eatery"],"group_type": ["family", "couple", "solo", "friends"],"lang": ["en", "hi", "mr"],"listing_type": ["place", "stay", "eatery", "dish"],"monsoon_status": ["open", "risky", "closed"],"place_category": ["beach", "fort", "temple", "waterfall", "viewpoint", "backwater", "cave", "museum", "village", "market", "orchard"],"price_source": ["owner", "agoda", "affiliate"],"qr_entity_type": ["place", "stay", "eatery", "station", "bus_stand"],"report_status": ["new", "triaged", "fixed", "rejected"],"report_type": ["broken_qr", "garbage", "unsafe_spot", "wrong_info"],"review_status": ["pending", "approved", "rejected"],"season": ["turtle_nesting", "mango", "firefly", "waterfall"],"service_style": ["homely", "professional"],"stop_kind": ["place", "stay", "meal"],"sub_score_dimension": ["taste", "authenticity", "hygiene", "value", "cleanliness", "host", "location"],"theme": ["system", "light", "dark"],"tide_provider": ["tidesatlas", "tidecheck"],"trip_pace": ["relaxed", "balanced", "packed"],"trip_status": ["draft", "saved", "completed"],"utility_type": ["fuel", "atm", "hospital", "pharmacy", "police", "toilet", "ev_charger", "mechanic", "bus_stand", "railway_station", "ferry_jetty"],"visit_method": ["qr_gps", "booking_proof"]
          }
        }
} as const
