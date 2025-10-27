# Taken from DeepFaceLab Landmark processor
import numpy as np
import cv2

def get_image_eye_mask (image_shape, image_landmarks):
    if len(image_landmarks) != 68:
        raise Exception('get_image_eye_mask works only with 68 landmarks')

    h,w,c = image_shape

    hull_mask = np.zeros( (h,w,1),dtype=np.float32)

    image_landmarks = image_landmarks.astype(np.int)

    cv2.fillConvexPoly( hull_mask, cv2.convexHull( image_landmarks[36:42]), (1,) )
    cv2.fillConvexPoly( hull_mask, cv2.convexHull( image_landmarks[42:48]), (1,) )

    dilate = h // 32
    hull_mask = cv2.dilate(hull_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(dilate,dilate)), iterations = 1 )

    blur = h // 16
    blur = blur + (1-blur % 2)
    hull_mask = cv2.GaussianBlur(hull_mask, (blur, blur) , 0)
    hull_mask = hull_mask[...,None]

    return hull_mask

def get_image_mouth_mask (image_shape, image_landmarks):
    if len(image_landmarks) != 68:
        raise Exception('get_image_eye_mask works only with 68 landmarks')

    h,w,c = image_shape

    hull_mask = np.zeros( (h,w,1),dtype=np.float32)

    image_landmarks = image_landmarks.astype(np.int)

    cv2.fillConvexPoly( hull_mask, cv2.convexHull( image_landmarks[60:]), (1,) )

    dilate = h // 32
    hull_mask = cv2.dilate(hull_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(dilate,dilate)), iterations = 1 )

    blur = h // 16
    blur = blur + (1-blur % 2)
    hull_mask = cv2.GaussianBlur(hull_mask, (blur, blur) , 0)
    hull_mask = hull_mask[...,None]

    return hull_mask