from DFLPNG import DFLPNG
from DFLJPG import DFLJPG
from landmark_utils import *
from pose import *
import os
import pickle
from PIL import Image
import json
import argparse
import sys
import cv2

# fix for local importing
file_dir = os.path.dirname(__file__)
sys.path.append(file_dir)


def get_file_list(input_dir):
    """ Return list of images at specified location """
    result = []
    extensions = [".jpg", ".png", ".jpeg"]
    for root, _, files in os.walk(input_dir + '/'):
        for file in files:
            if os.path.splitext(file)[1].lower() in extensions:
                result.append(os.path.join(root, file))
        break

    return result


def to_JSON(filename, data):
    out = dict()
    out['name'] = filename
    # print (data.get_xseg_mask().tostring())
    if os.path.splitext(filename)[-1].lower() in [".jpg", ".jpeg"] and len(data.get_dict()) == 0:
        data = None

    pose = get_pose(filename, data.get_landmarks())

    if data is None:
        out['type'] = ''
        out['parentName'] = ''
        out['landmarks'] = ''
        out['sourceLandmarks'] = ''
        out['matrix'] = ''
        out['x'] = ''
        out['y'] = ''
        out['w'] = ''
        out['h'] = ''
        out['iePolys'] = ''
        out['eyebrowsExpand'] = ''
        out['pose'] = ''
    else:
        out['type'] = data.get_face_type()
        out['parentName'] = data.get_source_filename()
        out['landmarks'] = [[round(float(sublist[0]), 2), round(
            float(sublist[1]), 2)] for sublist in data.get_landmarks()]
        out['sourceLandmarks'] = [[round(float(sublist[0]), 2), round(
            float(sublist[1]), 2)] for sublist in data.get_source_landmarks()]
        out['x'] = int(data.get_source_rect()[0])
        out['y'] = int(data.get_source_rect()[1])
        out['w'] = int(data.get_source_rect()[2] - data.get_source_rect()[0])
        out['h'] = int(data.get_source_rect()[3] - data.get_source_rect()[1])
        out['matrix'] = [item for sublist in data.get_image_to_face_mat()
                         for item in sublist]
        out['iePolys'] = get_ie_polys(data)
        out['eyebrowsExpand'] = float(data.get_eyebrows_expand_mod(
        )) if data.get_eyebrows_expand_mod() != None else 1.0
        out['customParams'] = data.get_custom_params(
        ) if data.get_custom_params() != None else []
        out['xsegMask'] = get_xseg_mask_data(data)
        out['pose'] = pose
        # print (data.get_xseg_mask())
    out_json = json.dumps(out)

    return out_json


def get_xseg_mask_data(data):
    xseg_data = data.get_xseg_mask()
    if xseg_data == None:
        return None

    return xseg_data.hex()


def get_ie_polys(data):
    polys = data.get_seg_ie_polys()
    if polys is None:
        return ''

    polys = polys.dump()
    polys_ser = serialize_seg_poly_to_array(polys)

    return polys_ser


def get_pose(image_path, landmarks):
    im = Image.open(image_path)
    width, height = im.size
    pose = estimate_pitch_yaw_roll(landmarks, width)

    return pose


def serialize_seg_poly_to_array(data):
    polys_list = []
    for poly in data['polys']:
        poly_points = []
        for point in poly['pts']:
            poly_points.append(
                [round(float(point[0]), 2), round(float(point[1]), 2)])
        polys_list.append([int(poly['type']), poly_points])

    return polys_list


def from_JSON(data):
    json_data = json.loads(data)
    return json_data


def load_folder_data(image_folder):
    files = get_file_list(image_folder)

    for file in files:
        out = load_data(file)
        json_out = to_JSON(file, out)
        # print (json_out)
        sys.stdout.write(json_out + '\n')


def load_data(file):
    if os.path.splitext(file)[1].lower() in [".jpg", ".jpeg"]:
        out = DFLJPG.load(file)
    else:
        out = DFLPNG.load(file)

    return out


def save_data(image_folder):
    files = get_file_list(image_folder)

    for file in files:
        if os.path.exists(file) == False:
            continue

        data_json = input(file)
        if (len(data_json) < 2):
            continue

        d = from_JSON(data_json)
        file_load = load_data(file)
        # generate data dic
        dataDic = {}
        dataDic['type'] = d['type'] if d['type'] != '' else None
        dataDic['parentName'] = d['parentName'] if d['parentName'] != '' else None
        dataDic['rect'] = [d['x'], d['y'], d['x'] + d['w'],
                           d['y'] + d['h']] if d['h'] != -1 else None
        dataDic['mat'] = [[d['matrix'][0], d['matrix'][1], d['matrix'][2]], [
            d['matrix'][3], d['matrix'][4], d['matrix'][5]]] if len(d['matrix']) > 0 else None
        dataDic['landmarks'] = d['landmarks'] if len(
            d['landmarks']) > 0 else None
        dataDic['sourceLandmarks'] = d['sourceLandmarks'] if len(
            d['sourceLandmarks']) > 0 else None
        dataDic['eyebrowsExpand'] = d['eyebrowsExpand'] if d['eyebrowsExpand'] > 0 else None
        dataDic['customParams'] = d['customParams'] if len(
            d['customParams']) > 0 else None
        dataDic['segPolys'] = d['iePolys'] if len(d['iePolys']) > 0 else None

        if (file_load is not None):
            file_load.embed_and_set(file, face_type=dataDic['type'], source_filename=dataDic['parentName'],
                                    source_landmarks=dataDic['sourceLandmarks'], source_rect=dataDic['rect'],
                                    image_to_face_mat=dataDic['mat'], landmarks=dataDic[
                                        'landmarks'], custom_params=dataDic['customParams'],
                                    seg_ie_polys=dataDic['segPolys'], eyebrows_expand_mod=dataDic['eyebrowsExpand'])
        else:
            if os.path.splitext(file)[1].lower() in [".jpg", ".jpeg"]:
                DFLJPG.embed_data(file, face_type=dataDic['type'], source_filename=dataDic['parentName'],
                                  source_landmarks=dataDic['sourceLandmarks'], source_rect=dataDic['rect'],
                                  image_to_face_mat=dataDic['mat'], landmarks=dataDic[
                                      'landmarks'], custom_params=dataDic['customParams'],
                                  seg_ie_polys=dataDic['segPolys'], eyebrows_expand_mod=dataDic['eyebrowsExpand'])
            else:
                DFLPNG.embed_data(file, face_type=dataDic['type'], source_filename=dataDic['parentName'],
                                  source_landmarks=dataDic['sourceLandmarks'], source_rect=dataDic['rect'],
                                  image_to_face_mat=dataDic['mat'], landmarks=dataDic['landmarks'], eyebrows_expand_mod=dataDic['eyebrowsExpand'])


def update_parent_to_self(image_folder):
    files = get_file_list(image_folder)

    for file in files:
        file_load = load_data(file)
        if file_load is not None:
            file_load.embed_and_set(file, source_filename=file, source_landmarks=file_load.get_landmarks(
            ), source_rect=[0, 0, 256, 256])
            # print (file)
            sys.stdout.write(file + '\n')


def recalculate_masks(from_img, from_img_size, to_img, to_img_size, mask_size=256):
    from_mat = from_img.get_image_to_face_mat()
    if from_mat is None:
        return

    to_mat = to_img.get_image_to_face_mat()
    if to_mat is None:
        return

    mat = np.matmul(np.vstack([to_mat, [0, 0, 1]]), np.vstack(
        [cv2.invertAffineTransform(from_mat), [0, 0, 1]]))[:2]
    xseg_mask = from_img.get_xseg_mask(dfl_type=True)
    if xseg_mask is not None:
        xseg_mask = cv2.resize(xseg_mask, from_img_size,
                               interpolation=cv2.INTER_CUBIC)

        xseg_mask = np.clip(xseg_mask, 0, 1)
        xseg_mask = cv2.warpAffine(
            xseg_mask, mat, to_img_size, flags=cv2.INTER_CUBIC)
        # xseg_mask[xseg_mask < 0.5] = 0
        # xseg_mask[xseg_mask >= 0.5] = 1

        xseg_mask = cv2.resize(
            xseg_mask, (mask_size, mask_size), interpolation=cv2.INTER_CUBIC)
        xseg_mask[xseg_mask < 0.5] = 0
        xseg_mask[xseg_mask >= 0.5] = 1
        # to_img.set_xseg_mask(xseg_mask)

    polys = from_img.get_seg_ie_polys()
    if polys is not None:
        # raw copy from resizer
        for poly in polys.get_polys():
            points = poly.get_pts()
            points = np.expand_dims(points, axis=1)
            points = cv2.transform(points, mat, points.shape)
            points = np.squeeze(points)

            poly.set_points(points)

        # to_img.set_seg_ie_polys(polys)

    # copy landmarks
    landmarks = from_img.get_landmarks()
    landmarks = np.expand_dims(landmarks, axis=1)
    landmarks = cv2.transform(landmarks, mat, landmarks.shape)
    landmarks = np.squeeze(landmarks)
    # to_img.set_landmarks(points)

    return xseg_mask, polys, landmarks

# copy by parent frame, expecting from folder faces to be single per frame


def recalculate_copy(from_folder, to_folder):
    # make a parent lookup dic
    from_folder_files = get_file_list(from_folder)
    from_folders_dict = dict()

    for file in from_folder_files:
        file_loaded = load_data(file)
        if file_loaded is None:
            continue

        parent_filename = file_loaded.get_source_filename()
        if parent_filename is None:
            continue

        if parent_filename in from_folders_dict:
            continue

        # using filenames, file data could have RAM issues with masks
        from_folders_dict[parent_filename] = file

    to_folder_files = get_file_list(to_folder)

    for file in to_folder_files:
        to_file_data = load_data(file)
        if to_file_data is None:
            continue

        parent_filename = to_file_data.get_source_filename()
        if parent_filename is None:
            continue

        from_file = from_folders_dict.get(parent_filename)
        if from_file is None:
            continue

        from_file_data = load_data(from_file)

        to_file_image = Image.open(file)
        from_file_img = Image.open(from_file)

        xseg, polys, landmarks = recalculate_masks(
            from_file_data, from_file_img.size, to_file_data, to_file_image.size)

        # do not change mat
        type = to_file_data.get_face_type()
        mat = to_file_data.get_image_to_face_mat()

        # skip 3d landmarks
        if type == 'head':
            landmarks = to_file_data.get_landmarks()
            source_landmarks = to_file_data.get_source_landmarks()
        else:
            source_landmarks = from_file_data.get_source_landmarks()


        DFLJPG.embed_data(file,
                          face_type=type,
                          source_filename=parent_filename,
                          source_landmarks=source_landmarks,
                          landmarks=landmarks,
                          source_rect=from_file_data.get_source_rect(),
                          image_to_face_mat=mat,
                          eyebrows_expand_mod=from_file_data.get_eyebrows_expand_mod(),
                          seg_ie_polys=polys,
                          xseg_mask=xseg
                          )

        sys.stdout.write(file + '\n')


def recalculate_to_parent_frame(image_folder, child_folder):
    child_folder_files = get_file_list(child_folder)
    for child_file in child_folder_files:
        chile_file_data = load_data(child_file)
        if chile_file_data is None:
            continue

        parent_filename = chile_file_data.get_source_filename()
        if parent_filename is None:
            continue

        parent_file = os.path.join(image_folder, parent_filename)
        if (os.path.isfile(parent_file) == False):
            continue

        file_load = load_data(parent_file)
        if file_load is None:
            continue

        mat_child = chile_file_data.get_image_to_face_mat()
        mat_parent = file_load.get_image_to_face_mat()
        mat = np.matmul(np.vstack([mat_child, [0, 0, 1]]), np.vstack(
            [mat_parent, [0, 0, 1]]))[:2]

        chile_file_data.embed_and_set(child_file,
                                      face_type=chile_file_data.get_face_type(),
                                      source_filename=file_load.get_source_filename(),
                                      source_landmarks=file_load.get_source_landmarks(),
                                      landmarks=chile_file_data.get_landmarks(),
                                      source_rect=file_load.get_source_rect(),
                                      image_to_face_mat=mat,
                                      eyebrows_expand_mod=file_load.get_eyebrows_expand_mod(),
                                      seg_ie_polys=chile_file_data.get_seg_ie_polys(),
                                      xseg_mask=chile_file_data.get_xseg_mask(
                                          dfl_type=True)
                                      )

        sys.stdout.write(child_file + '\n')


def copy_to_file(image_folder, copy_folder, only_parent_data=False, recalculate=False):
    files = get_file_list(image_folder)
    for file in files:
        file_load = load_data(file)
        if file_load is not None:
            copy_file = os.path.join(copy_folder, os.path.basename(file))
            pre, ext = os.path.splitext(copy_file)
            copy_file = pre + '.png'
            if (os.path.isfile(copy_file) == False):
                copy_file = pre + '.jpg'
                if (os.path.isfile(copy_file) == False):
                    continue

            # recalc landmarks, polys and mask
            if os.path.splitext(copy_file)[1].lower() in [".jpg", ".jpeg"]:
                if recalculate:
                    input_file = Image.open(file)
                    copy_file_img = Image.open(copy_file)

                    copy_img = load_data(copy_file)
                    type = copy_img.get_face_type()

                    xseg, polys, landmarks = recalculate_masks(
                        file_load, input_file.size, copy_img, copy_file_img.size)

                    # skip 3d landmarks
                    if type == 'head':
                        landmarks = copy_img.get_landmarks()
                        source_landmarks = copy_img.get_source_landmarks()
                    else:
                        source_landmarks = file_load.get_source_landmarks()

                    # do not change mat
                    mat = copy_img.get_image_to_face_mat()
                else:
                    landmarks = file_load.get_landmarks()
                    source_landmarks = file_load.get_source_landmarks()
                    polys = file_load.get_seg_ie_polys()
                    xseg = file_load.get_xseg_mask(dfl_type=True)
                    mat = file_load.get_image_to_face_mat()
                    type = file_load.get_face_type()

                if only_parent_data:
                    copy_img = load_data(copy_file)
                    copy_img.embed_and_set(copy_file,
                                           source_filename=file_load.get_source_filename(),
                                           source_landmarks=source_landmarks,
                                           source_rect=file_load.get_source_rect(),
                                           )
                else:
                    DFLJPG.embed_data(copy_file,
                                      face_type=type,
                                      source_filename=file_load.get_source_filename(),
                                      source_landmarks=source_landmarks,
                                      landmarks=landmarks,
                                      source_rect=file_load.get_source_rect(),
                                      image_to_face_mat=mat,
                                      eyebrows_expand_mod=file_load.get_eyebrows_expand_mod(),
                                      seg_ie_polys=polys,
                                      xseg_mask=xseg
                                      )
            else:
                if recalculate:  # TODO
                    print('PNG not supported')
                    return
                if only_parent_data:
                    copy_img = load_data(copy_file)
                    copy_img.embed_and_set(copy_file,
                                           source_filename=file_load.get_source_filename(),
                                           source_landmarks=file_load.get_source_landmarks(),
                                           source_rect=file_load.get_source_rect(),
                                           )
                else:
                    DFLPNG.embed_data(copy_file,
                                      face_type=file_load.get_face_type(),
                                      source_filename=file_load.get_source_filename(),
                                      source_landmarks=file_load.get_source_landmarks(),
                                      landmarks=file_load.get_landmarks(),
                                      source_rect=file_load.get_source_rect(),
                                      eyebrows_expand_mod=file_load.get_eyebrows_expand_mod(),
                                      image_to_face_mat=file_load.get_image_to_face_mat()
                                      )
        sys.stdout.write(file + '\n')


def face_reexport_masks(image_folder, copy_folder, mask_size=256, ignore_eye_mouth=False):
    to_files = get_file_list(copy_folder)
    for to_file in to_files:
        to_file_load = load_data(to_file)
        if to_file_load is None:
            continue

        parent_name = to_file_load.get_source_filename()
        if parent_name is None:
            continue

        from_file = os.path.join(image_folder, parent_name)
        if (os.path.isfile(from_file) == False):
            continue

        from_file_load = load_data(from_file)
        if from_file_load is None:
            continue

        to_file_file = Image.open(to_file)
        from_file_file = Image.open(from_file)

        mat = to_file_load.get_image_to_face_mat()
        xseg_mask = from_file_load.get_xseg_mask(dfl_type=True)
        xseg_mask = cv2.resize(
            xseg_mask, from_file_file.size, interpolation=cv2.INTER_CUBIC)
        if xseg_mask is not None:
            if ignore_eye_mouth is True:
                eye_mask = get_image_eye_mask(
                    [from_file_file.size[0], from_file_file.size[1], 1], from_file_load.get_landmarks())
                mouth_mask = get_image_mouth_mask(
                    [from_file_file.size[0], from_file_file.size[1], 1], from_file_load.get_landmarks())

                xseg_mask = xseg_mask - \
                    np.squeeze(eye_mask) - np.squeeze(mouth_mask)
                xseg_mask = np.clip(xseg_mask, 0, 1)

            xseg_mask = np.clip(xseg_mask, 0, 1)
            xseg_mask = cv2.warpAffine(
                xseg_mask, mat, to_file_file.size, flags=cv2.INTER_CUBIC)
            xseg_mask = cv2.resize(
                xseg_mask, (mask_size, mask_size), interpolation=cv2.INTER_CUBIC)
            xseg_mask[xseg_mask < 0.5] = 0
            xseg_mask[xseg_mask >= 0.5] = 1

            to_file_load.set_xseg_mask(xseg_mask)

        polys = from_file_load.get_seg_ie_polys()
        if polys is not None:
            # raw copy from resizer
            for poly in polys.get_polys():
                points = poly.get_pts()
                points = np.expand_dims(points, axis=1)
                points = cv2.transform(points, mat, points.shape)
                points = np.squeeze(points)

                poly.set_points(points)

            to_file_load.set_seg_ie_polys(polys)
        to_file_load.save()

        sys.stdout.write(to_file + '\n')


def convert_png_to_jpg(png_path, jpg_path):
    png_images = get_file_list(png_path)

    for file in png_images:
        file_load = load_data(file)
        if file_load is None:
            print('No file data for file' + file)
            continue

        file_mat = cv2.imread(file)
        pre, ext = os.path.splitext(os.path.basename(file))
        copy_file = os.path.join(jpg_path, pre + '.jpg')
        cv2.imwrite(copy_file, file_mat, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        DFLJPG.embed_data(copy_file,
                          face_type=file_load.get_face_type(),
                          source_filename=file_load.get_source_filename(),
                          source_landmarks=file_load.get_source_landmarks(),
                          landmarks=file_load.get_landmarks(),
                          source_rect=file_load.get_source_rect(),
                          image_to_face_mat=file_load.get_image_to_face_mat()
                          )
        print('Done: ' + copy_file)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("input_folder")
    parser.add_argument("--save", action='store_true')
    # updates file name to self dont use
    parser.add_argument("--utoself", action='store_true')
    parser.add_argument("--copy")
    parser.add_argument("--copy_parent", action='store_true')
    parser.add_argument("--reexport_masks", action='store_true')
    parser.add_argument("--ignore_m_e", action='store_true')
    parser.add_argument("--recalc", action='store_true')
    parser.add_argument("--recalc_in_frame", action='store_true')
    parser.add_argument("--jpg_folder")
    args = parser.parse_args()

    if args.jpg_folder is not None:
        convert_png_to_jpg(args.input_folder, args.jpg_folder)
        exit(0)

    if args.recalc_in_frame == True:
        recalculate_to_parent_frame(args.input_folder, args.copy)
        exit(0)

    if args.utoself == True:
        update_parent_to_self(args.input_folder)
        exit(0)

    if args.reexport_masks == True:
        face_reexport_masks(args.input_folder, args.copy,
                            ignore_eye_mouth=args.ignore_m_e)
        exit(0)

    if args.recalc == True:
        recalculate_copy(args.input_folder, args.copy)
        exit(0)

    if args.copy is not None:
        copy_to_file(args.input_folder, args.copy,
                     args.copy_parent, args.recalc)
        exit(0)

    if args.save == True:
        save_data(args.input_folder)
    else:
        load_folder_data(args.input_folder)
