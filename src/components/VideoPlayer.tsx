"use client"

import React, { useEffect, useRef, useState } from 'react';

type Props = {
    stream: MediaStream;
};

const VideoPlayer = ({ stream }: Props) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            controls={false}
            className='w-full h-full object-cover'
            muted
        />
    )
}

export default VideoPlayer;